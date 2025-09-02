// src/core/registry/SourceRegistry.ts
import type { SourceDef } from '../../api/types';

type SourceFactory = () => SourceDef;

export class SourceRegistry {
  private static registry = new Map<string, SourceFactory>();

  static register(id: string, factory: SourceFactory) {
    this.registry.set(id, factory);
  }

  static get(id: string): SourceDef {
    const factory = this.registry.get(id);
    if (!factory) {
      throw new Error(`Source '${id}' not found in SourceRegistry`);
    }
    return factory();
  }

  static clear() {
    this.registry.clear();
  }
}