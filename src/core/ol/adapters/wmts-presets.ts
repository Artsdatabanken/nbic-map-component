import type { Extent } from 'ol/extent';

export type WMTSPresetKey = 'npolar-svalbard-32633' | 'npolar-janmayen-25833';

export function wmtsPreset(key: WMTSPresetKey): {
    layerExtent: Extent;
    matrixExtent: Extent;
    matrixIds: string[];
} {
    const matrixXMin = -5118180;
    const matrixYMin = 7224500;
    const matrixWidth = 5545984;
    const matrixHeight = 2772992;
    const matrixExtent: Extent = [
        matrixXMin,
        matrixYMin,
        matrixXMin + matrixWidth,
        matrixYMin + matrixHeight,
    ];
    switch (key) {
        case 'npolar-svalbard-32633': {                        
            return {
                layerExtent: [369976, 8221306, 878234, 9010718],
                matrixExtent,
                matrixIds: Array.from({ length: 18 }, (_, z) => z.toString()),
            };            
        }
        case 'npolar-janmayen-25833': {            
            return {
                layerExtent: [-393783, 7978220, 276963, 8084965],
                matrixExtent: matrixExtent,
                matrixIds: Array.from({ length: 18 }, (_, z) => z.toString()),
            };
        }
    }
}