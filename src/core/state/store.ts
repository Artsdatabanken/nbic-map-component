// src/core/state/store.ts
export interface Emitter<T extends Record<string, unknown>> {
    on<K extends keyof T>(type: K, cb: (payload: T[K]) => void): () => void;
    off<K extends keyof T>(type: K, cb: (payload: T[K]) => void): void;
    emit<K extends keyof T>(type: K, payload: T[K]): void;
}

export function createEmitter<T extends Record<string, unknown>>(): Emitter<T> {
    const listeners: { [K in keyof T]?: Array<(payload: T[K]) => void> } = {};

    return {
        on(type, cb) {
            (listeners[type] ??= []).push(cb);
            return () => this.off(type, cb);
        },
        off(type, cb) {
            listeners[type] = (listeners[type] ?? []).filter(fn => fn !== cb);
        },
        emit(type, payload) {
            (listeners[type] ?? []).forEach(fn => fn(payload));
        },
    };
}