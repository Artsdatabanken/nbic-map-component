// src/index.test.ts
import { describe, it, expect } from 'vitest';
import { NbicMapComponent } from './index';

describe('NbicMapComponent', () => {
    it('exports class', () => {
        expect(typeof NbicMapComponent).toBe('function');
    });
});