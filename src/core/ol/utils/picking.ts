import type BaseLayer from 'ol/layer/Base';

export function isPickableLayer(l: unknown): boolean {
    if (!l || typeof (l as BaseLayer).get !== 'function') return false;
    const get = (l as BaseLayer).get.bind(l);
    const role = get('nbic:role');
    if (role === 'hover') return false;
    const vis = (l as BaseLayer).getVisible?.();
    if (vis === false) return false;
    return true;
}