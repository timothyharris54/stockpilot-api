import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuthTokenService } from './services/auth-token.service';
import { RequestIdentity } from './interfaces/request-identity.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(email: string, _password: string) {
    //console.log('In login: '+email);
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const identity: RequestIdentity = {
      userId: user.id,
      accountId: user.accountId,
      email: user.email,
    };

    const accessToken = await this.authTokenService.signAccessToken(identity);

    return {
      accessToken,
      identity: {
        userId: identity.userId.toString(),
        accountId: identity.accountId.toString(),
        email: identity.email,
      },
    };
  }
}