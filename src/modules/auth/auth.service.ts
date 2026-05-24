import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';
import { RequestIdentity } from './interfaces/request-identity.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(email: string, _password: string, roleCode?: UserRoleCode) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const availableRoles = user.userRoles
      .filter((userRole) => userRole.role.isActive)
      .map((userRole) => userRole.role)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    const selectedRole = roleCode
      ? availableRoles.find((role) => role.code === roleCode)
      : availableRoles[0];

    if (!selectedRole) {
      throw new UnauthorizedException('Role is not assigned to this user.');
    }

    const identity: RequestIdentity = {
      userId: user.id,
      accountId: user.accountId,
      email: user.email,
      roleCode: selectedRole.code,
    };

    const accessToken = await this.authTokenService.signAccessToken(identity);

    return {
      accessToken,
      identity: {
        userId: identity.userId.toString(),
        accountId: identity.accountId.toString(),
        email: identity.email,
        roleCode: identity.roleCode,
        roleName: selectedRole.displayName,
      },
      availableRoles: availableRoles.map((role) => ({
        code: role.code,
        displayName: role.displayName,
      })),
    };
  }
}
