import {
    buildGroupExportExcelBase64,
    buildGroupExportExcelBuffer,
} from '../../lib/groupExportExcel';
import type { FeedItem, Group, GroupMemberLite } from '@cost-share/shared';
import type { TFunction } from 'i18next';

const t = ((key: string) => key) as TFunction;

const group: Group = {
    id: 'g1',
    name: 'Trip',
    groupType: 'trip',
    defaultCurrency: 'ILS',
    inviteToken: 'tok',
    createdBy: 'u1',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

const members: GroupMemberLite[] = [
    { userId: 'u1', displayName: 'Alice', isActive: true },
    { userId: 'u2', displayName: 'Bob', isActive: true },
];

const feed: FeedItem[] = [
    {
        kind: 'message',
        sortAt: new Date('2026-05-19T10:00:00'),
        message: {
            id: 'm1',
            groupId: 'g1',
            userId: 'u1',
            body: 'Hello group',
            editedAt: null,
            isDeleted: false,
            createdAt: new Date('2026-05-19T10:00:00'),
            updatedAt: new Date('2026-05-19T10:00:00'),
        },
    },
];

function isZipBuffer(buf: ArrayBuffer): boolean {
    const bytes = new Uint8Array(buf);
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

describe('buildGroupExportExcelBuffer', () => {
    it('returns an XLSX (ZIP) buffer with group export content', async () => {
        const buf = await buildGroupExportExcelBuffer({
            group,
            feed,
            debts: [],
            members,
            exportedAt: new Date('2026-05-20T12:00:00'),
            language: 'en',
            t,
        });

        expect(isZipBuffer(buf)).toBe(true);

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx') as typeof import('xlsx');
        const book = XLSX.read(buf, { type: 'array' });
        const sheet = book.Sheets.Trip;
        expect(sheet).toBeDefined();
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        const flat = rows.flat().join('\n');
        expect(flat).toContain('Trip');
        expect(flat).toContain('Alice');
        expect(flat).toContain('Hello group');
    });
});

describe('buildGroupExportExcelBase64', () => {
    it('encodes the same workbook bytes as base64', async () => {
        const input = {
            group,
            feed: [],
            debts: [],
            members,
            exportedAt: new Date('2026-05-20T12:00:00'),
            language: 'he' as const,
            t,
        };
        const buf = await buildGroupExportExcelBuffer(input);
        const base64 = await buildGroupExportExcelBase64(input);

        const fromBase64 = Uint8Array.from(atob(base64), c => c.codePointAt(0) ?? 0);
        expect(fromBase64).toEqual(new Uint8Array(buf));
    });
});
