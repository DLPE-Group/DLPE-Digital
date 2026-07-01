import { describe, it, expect } from 'vitest';
import { entityToCardDTO, entityToVehicleDTO } from '../../server/src/domain/projection.ts';

// Pure-function parity: a synthetic pipeline entity projects to the exact Card
// DTO shape the frontend expects; a reference entity projects to the vehicle shape.
describe('projection functions', () => {
  it('projects a pipeline entity to a Card DTO', () => {
    const entity = {
      id: 's5', companyId: 'cmp-brussels', trackId: 'sales',
      title: 'Brussels Energy SA', value: 120000, owner: 'Eva de Vries',
      status: 'amber', sub: 'Renewal · 14 vehicles', sources: ['CRM'],
      stageId: 'contract', stageName: 'Contract', days: 3, daysLabel: '3d in stage',
      cta: 'Review contract', awaitingSign: true,
      fields: { type: 'RENEWAL', vehicle: 'BX-1234', meta: { foo: 1 } },
      createdById: null,
    };
    expect(entityToCardDTO(entity)).toEqual({
      id: 's5', companyId: 'cmp-brussels', track: 'sales', type: 'RENEWAL',
      customer: 'Brussels Energy SA', value: 120000, vehicle: 'BX-1234',
      sub: 'Renewal · 14 vehicles', stageId: 'contract', stageName: 'Contract',
      days: 3, daysLabel: '3d in stage', owner: 'Eva de Vries', status: 'amber',
      cta: 'Review contract', sources: ['CRM'], awaitingSign: true,
      meta: { foo: 1 }, createdById: null,
    });
  });

  it('projects a reference entity to a Vehicle DTO', () => {
    const entity = {
      id: 'veh1', companyId: 'cmp-rotterdam', title: 'NL-AB-123',
      status: 'active',
      fields: { plate: 'NL-AB-123', model: 'VW ID.4', vin: 'WVW...', operator: 'Acme', statusLabel: 'On road', note: 'n/a' },
    };
    expect(entityToVehicleDTO(entity)).toEqual({
      id: 'veh1', plate: 'NL-AB-123', model: 'VW ID.4', vin: 'WVW...',
      operator: 'Acme', status: 'active', statusLabel: 'On road', note: 'n/a',
      companyId: 'cmp-rotterdam',
    });
  });
});
