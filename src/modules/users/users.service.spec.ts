import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRoleCode } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const txMock = {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    userRole: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prismaMock = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(txMock)),
  };

  const buyerRole = {
    id: 20n,
    code: UserRoleCode.buyer,
    displayName: 'Buyer',
  };
  const plannerRole = {
    id: 21n,
    code: UserRoleCode.planner,
    displayName: 'Planner',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prismaMock as unknown as PrismaService);
  });

  it('creates a user and selected roles in one transaction', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([buyerRole, plannerRole]);
    txMock.user.create.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
    });
    txMock.user.findFirstOrThrow.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
      fullName: 'New User',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      userRoles: [{ role: buyerRole }, { role: plannerRole }],
    });

    const result = await service.create(1n, {
      email: 'new@example.com',
      fullName: 'New User',
      roleCodes: [UserRoleCode.buyer, UserRoleCode.planner],
    });

    expect(txMock.user.create).toHaveBeenCalledWith({
      data: {
        accountId: 1n,
        email: 'new@example.com',
        fullName: 'New User',
        isActive: true,
      },
    });
    expect(txMock.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { accountId: 1n, userId: 10n, roleId: 20n },
        { accountId: 1n, userId: 10n, roleId: 21n },
      ],
    });
    expect(result.roles).toEqual([
      { code: UserRoleCode.buyer, displayName: 'Buyer' },
      { code: UserRoleCode.planner, displayName: 'Planner' },
    ]);
  });

  it('rejects duplicate user emails within the account', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 10n,
      accountId: 1n,
      email: 'new@example.com',
    });

    await expect(
      service.create(1n, {
        email: 'new@example.com',
        roleCodes: [UserRoleCode.buyer],
      }),
    ).rejects.toThrow(ConflictException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid role codes before creating a user', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.role.findMany.mockResolvedValue([]);

    await expect(
      service.create(1n, {
        email: 'new@example.com',
        roleCodes: [UserRoleCode.buyer],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
