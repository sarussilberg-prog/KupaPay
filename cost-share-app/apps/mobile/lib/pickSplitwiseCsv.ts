import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export type PickCsvOutcome =
    | { ok: true; fileName: string; text: string }
    | { ok: false; error: 'cancelled' | 'read_failed' | 'unsupported' };

export async function pickSplitwiseCsvFile(): Promise<PickCsvOutcome> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
        multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) {
        return { ok: false, error: 'cancelled' };
    }

    const asset = result.assets[0];
    const uri = asset.uri;
    const fileName = asset.name ?? 'splitwise-export.csv';

    try {
        const text = await FileSystem.readAsStringAsync(uri);
        return { ok: true, fileName, text };
    } catch {
        return { ok: false, error: 'read_failed' };
    }
}
