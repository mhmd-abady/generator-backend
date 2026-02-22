import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}


private hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

private generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

  async login(dto: LoginDto) {
    

    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
const now = new Date();

// Locked?
if (user.lockedUntil && user.lockedUntil > now) {
  throw new UnauthorizedException('Account temporarily locked');
}
    const valid = await argon2.verify(user.password, dto.password);
    if (!valid) {
  const attempts = user.failedLoginAttempts + 1;

  await this.prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      lockedUntil: attempts >= 5
        ? new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes
        : null,
    },
  });

  throw new UnauthorizedException('Invalid credentials');
}
await this.prisma.user.update({
  where: { id: user.id },
  data: {
    failedLoginAttempts: 0,
    lockedUntil: null,
  },
});
    const payload = {
      sub: user.id,
      role: user.role,
    };

const accessToken = await this.jwt.signAsync(payload, {
  expiresIn: '15m',
});

// 2) refresh token (1 day)
const refreshToken = this.generateRefreshToken();
const refreshTokenHash = this.hashToken(refreshToken);

const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

// 3) store refresh token hash
await this.prisma.refreshToken.create({
  data: {
    tokenHash: refreshTokenHash,
    userId: user.id,
    expiresAt,
  },
});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  async createUser(dto: CreateUserDto, creator: { role: UserRole }) {
    if (creator.role !== UserRole.ADMIN) {
      throw new UnauthorizedException('Only admins can create users');
    }
    if (dto.role === UserRole.ADMIN) {
      throw new UnauthorizedException('Cannot create admin users');
    }
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ username: dto.username }, { email: dto.email }] },
    });
    if (exists) {
      throw new UnauthorizedException('Username or email already taken');
    }
    const hash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    if(!dto.email){
        dto.email = `${dto.username}@kafra.com`
    }
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password: hash,
        role: dto.role,
      },
    });
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async changePassword(
  userId: number,
  dto: ChangePasswordDto,
) {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedException();

  const ok = await argon2.verify(user.password, dto.currentPassword);
  if (!ok) throw new UnauthorizedException('Invalid credentials');

  const hash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });

  await this.prisma.user.update({
    where: { id: userId },
    data: { password: hash },
  });

  return { success: true };
}

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    editor: { role: UserRole },
  ) {
    if (editor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update users');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot edit admin users');
    }
    if (dto.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot set role to admin');
    }

    if (dto.username || dto.email) {
      const exists = await this.prisma.user.findFirst({
        where: {
          OR: [
            ...(dto.username ? [{ username: dto.username }] : []),
            ...(dto.email ? [{ email: dto.email }] : []),
          ],
          NOT: { id: userId },
        },
      });
      if (exists) {
        throw new BadRequestException('Username or email already taken');
      }
    }

    const data: Record<string, any> = {};
    if (dto.username) data.username = dto.username;
    if (dto.email) data.email = dto.email;
    if (dto.role) data.role = dto.role;
    if (dto.password) {
      data.password = await argon2.hash(dto.password, {
        type: argon2.argon2id,
      });
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    return {
      id: updated.id,
      username: updated.username,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
    };
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    return users;
  }

async refresh(refreshToken: string) {
  // 1) hash incoming token
  const tokenHash = this.hashToken(refreshToken);

  // 2) find token in DB
  const stored = await this.prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!stored) {
    throw new UnauthorizedException('Invalid or expired refresh token');
  }

  // 3) issue NEW access token
  const payload = {
    sub: stored.user.id,
    role: stored.user.role,
  };

  const accessToken = await this.jwt.signAsync(payload, {
    expiresIn: '30m',
  });

  return { accessToken };
}
async logout(refreshToken: string) {
  const tokenHash = this.hashToken(refreshToken);

  await this.prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });

  return { success: true };
}


}
