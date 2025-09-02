// src/index.test.ts
import { describe, it, expect } from 'vitest';
import { MapConfigSchema } from './api/config.schema';

describe('MapConfigSchema', () => {
    it('validates minimal config', () => {
        const cfg = MapConfigSchema.parse({
            version: 1,
            id: 'demo',
            center: [0, 0],
            zoom: 2,
            maxZoom: 19,
        });
        expect(cfg).toHaveProperty('id', 'demo');
    });
});