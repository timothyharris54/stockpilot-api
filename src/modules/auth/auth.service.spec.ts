import { UnauthorizedException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';

describe('AuthService', () => {
  let service: AuthService;

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
    },
  };

  const authTokenServiceMock = {
    signAccessToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AuthService(
      prismaMock as unknown as PrismaService,
      authTokenServiceMock as unknown as AuthTokenService,
    );
  });

  it('signs the selected assigned role into the access token', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'buyer@example.com',
      userRoles: [
        {
          role: {
            code: UserRoleCode.planner,
            displayName: 'Planner',
            isActive: true,
          },
        },
        {
          role: {
            code: UserRoleCode.buyer,
            displayName: 'Buyer',
            isActive: true,
          },
        },
      ],
    });
    authTokenServiceMock.signAccessToken.mockResolvedValue('token');

    const result = await service.login(
      'buyer@example.com',
      'password',
      UserRoleCode.buyer,
    );

    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith({
      userId: 10n,
      accountId: 1n,
      email: 'buyer@example.com',
      roleCode: UserRoleCode.buyer,
    });
    expect(result.identity.roleCode).toBe(UserRoleCode.buyer);
    expect(result.availableRoles).toEqual([
      { code: UserRoleCode.buyer, displayName: 'Buyer' },
      { code: UserRoleCode.planner, displayName: 'Planner' },
    ]);
  });

  it('rejects role selection when the role is not assigned to the user', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'buyer@example.com',
      userRoles: [
        {
          role: {
            code: UserRoleCode.buyer,
            displayName: 'Buyer',
            isActive: true,
          },
        },
      ],
    });

    await expect(
      service.login('buyer@example.com', 'password', UserRoleCode.system_admin),
    ).rejects.toThrow(UnauthorizedException);

    expect(authTokenServiceMock.signAccessToken).not.toHaveBeenCalled();
  });
});
