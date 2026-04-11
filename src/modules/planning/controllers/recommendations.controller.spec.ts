import { Test, TestingModule } from '@nestjs/testing';
import { ReplenishmentController } from './replenishment.controller';
import { ReplenishmentEngineService } from '../services/replenishment-engine.service';
import { RequestIdentity } from 'src/modules/auth/interfaces/request-identity.interface';

describe('ReplenishmentController', () => { 
    let controller: ReplenishmentController;

    const replenishmentEngineServiceMock = {
        generateForProduct: jest.fn(),
        generateForAccount: jest.fn(),
    };

    const identity: RequestIdentity = {
        userId: 10n,
        accountId: 1n, 
        email: 'timothy.harris54@gmail.com'
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ReplenishmentController],
            providers: [
                {
                    provide: ReplenishmentEngineService,
                    useValue: replenishmentEngineServiceMock
                },
            ],
        }).compile();

        controller = module.get<ReplenishmentController>(ReplenishmentController);
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    })

    it('calls generateForProduct with identity.accountId and productId', async () => {
        replenishmentEngineServiceMock.generateForProduct.mockResolvedValue(
            { ok: true }
        );

        const result = await controller.generateForProduct(identity, '2', 'MAIN');

        expect(replenishmentEngineServiceMock.generateForProduct).toHaveBeenCalledWith(
            1n,
            2n,
            'MAIN',
            false,
        );
        expect(result).toEqual({ ok: true });
    });
    
    it('calls generateForAccount with accountId', async () => {
        replenishmentEngineServiceMock.generateForAccount.mockResolvedValue([
            { ok: true },
        ]);

        const result = await controller.generateForAccount(identity, 'MAIN');

        expect(replenishmentEngineServiceMock.generateForAccount).toHaveBeenCalledWith(
            1n, 
            'MAIN',
            false,
        );
        expect(result).toEqual([{ ok: true }]);
    });

});
