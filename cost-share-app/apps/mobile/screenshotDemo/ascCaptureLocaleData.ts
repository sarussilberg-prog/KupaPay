import type { GroupWithMembers, Language, SimplifiedInputsPayload } from '@cost-share/shared';
import { CAPTURE_GROUP_BARCELONA, CAPTURE_USER_ID } from './ascCaptureSeed';

type LocaleCopy = {
    you: string;
    groups: Array<{
        id: string;
        name: string;
        description: string;
        groupType: 'trip' | 'home' | 'event';
        defaultCurrency: string;
        members: Array<{ userId: string; displayName: string }>;
    }>;
};

const BASE_IDS = {
    barcelona: CAPTURE_GROUP_BARCELONA,
    roommates: 'g-roommates',
    shabbat: 'g-shabbat',
    ski: 'g-ski',
    office: 'g-office',
    wedding: 'g-wedding',
} as const;

const COPY: Record<Language, LocaleCopy> = {
    he: {
        you: 'את/ה',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'טיול לברצלונה',
                description: 'קיץ 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-dana', displayName: 'דנה' },
                    { userId: 'u-yoni', displayName: 'יוני' },
                    { userId: 'u-alex', displayName: 'אלכס' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'שותפים לדירה',
                description: 'דירת השותפים',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-maya', displayName: 'מאיה' },
                    { userId: 'u-idan', displayName: 'עידן' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'ארוחת שישי',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-noa', displayName: 'נועה' },
                    { userId: 'u-gal', displayName: 'גל' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'סקי בצפון',
                description: 'ינואר 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-dana', displayName: 'דנה' },
                    { userId: 'u-yoni', displayName: 'יוני' },
                    { userId: 'u-rotem', displayName: 'רותם' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'צוות המשרד',
                description: 'הוצאות יומיומיות',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-amit', displayName: 'עמית' },
                    { userId: 'u-liat', displayName: 'ליאת' },
                    { userId: 'u-omri', displayName: 'עומרי' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'חתונה של שירה ואור',
                description: 'סוף שבוע אחד',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'את/ה' },
                    { userId: 'u-shira', displayName: 'שירה' },
                    { userId: 'u-or', displayName: 'אור' },
                    { userId: 'u-gal', displayName: 'גל' },
                ],
            },
        ],
    },
    ar: {
        you: 'أنت',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'رحلة إلى برشلونة',
                description: 'صيف 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-dana', displayName: 'دانة' },
                    { userId: 'u-yoni', displayName: 'يوني' },
                    { userId: 'u-alex', displayName: 'أليكس' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'زملاء السكن',
                description: 'الشقة المشتركة',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-maya', displayName: 'مايا' },
                    { userId: 'u-idan', displayName: 'عيدان' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'عشاء الجمعة',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-noa', displayName: 'نوا' },
                    { userId: 'u-gal', displayName: 'غال' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'تزلج في الشمال',
                description: 'يناير 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-dana', displayName: 'دانة' },
                    { userId: 'u-yoni', displayName: 'يوني' },
                    { userId: 'u-rotem', displayName: 'روتم' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'فريق المكتب',
                description: 'مصروفات يومية',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-amit', displayName: 'أميت' },
                    { userId: 'u-liat', displayName: 'ليات' },
                    { userId: 'u-omri', displayName: 'عومري' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'حفل شيرا وأور',
                description: 'عطلة نهاية أسبوع',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'أنت' },
                    { userId: 'u-shira', displayName: 'شيرا' },
                    { userId: 'u-or', displayName: 'أور' },
                    { userId: 'u-gal', displayName: 'غال' },
                ],
            },
        ],
    },
    en: {
        you: 'You',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'Barcelona trip',
                description: 'Summer 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-alex', displayName: 'Alex' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'Roommates',
                description: 'Shared apartment',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-maya', displayName: 'Maya' },
                    { userId: 'u-idan', displayName: 'Idan' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'Friday dinner',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-noa', displayName: 'Noa' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'Ski weekend up north',
                description: 'January 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-rotem', displayName: 'Rotem' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'Office team',
                description: 'Day-to-day expenses',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-amit', displayName: 'Amit' },
                    { userId: 'u-liat', displayName: 'Liat' },
                    { userId: 'u-omri', displayName: 'Omri' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'Shira & Or wedding',
                description: 'One weekend',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'You' },
                    { userId: 'u-shira', displayName: 'Shira' },
                    { userId: 'u-or', displayName: 'Or' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
        ],
    },
    ru: {
        you: 'Вы',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'Поездка в Барселону',
                description: 'Лето 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-dana', displayName: 'Дана' },
                    { userId: 'u-yoni', displayName: 'Йони' },
                    { userId: 'u-alex', displayName: 'Алекс' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'Соседи по квартире',
                description: 'Общая квартира',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-maya', displayName: 'Майя' },
                    { userId: 'u-idan', displayName: 'Идан' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'Ужин в пятницу',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-noa', displayName: 'Ноа' },
                    { userId: 'u-gal', displayName: 'Галь' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'Лыжные выходные на севере',
                description: 'Январь 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-dana', displayName: 'Дана' },
                    { userId: 'u-yoni', displayName: 'Йони' },
                    { userId: 'u-rotem', displayName: 'Ротем' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'Офисная команда',
                description: 'Ежедневные траты',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-amit', displayName: 'Амит' },
                    { userId: 'u-liat', displayName: 'Лиат' },
                    { userId: 'u-omri', displayName: 'Омри' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'Свадьба Ширы и Ора',
                description: 'Один уик-энд',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Вы' },
                    { userId: 'u-shira', displayName: 'Шира' },
                    { userId: 'u-or', displayName: 'Ор' },
                    { userId: 'u-gal', displayName: 'Галь' },
                ],
            },
        ],
    },
    fr: {
        you: 'Vous',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'Voyage à Barcelone',
                description: 'Été 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-alex', displayName: 'Alex' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'Colocataires',
                description: 'Appartement partagé',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-maya', displayName: 'Maya' },
                    { userId: 'u-idan', displayName: 'Idan' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'Dîner du vendredi',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-noa', displayName: 'Noa' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'Week-end ski au nord',
                description: 'Janvier 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-rotem', displayName: 'Rotem' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'Équipe du bureau',
                description: 'Dépenses du quotidien',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-amit', displayName: 'Amit' },
                    { userId: 'u-liat', displayName: 'Liat' },
                    { userId: 'u-omri', displayName: 'Omri' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'Mariage de Shira et Or',
                description: 'Un week-end',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Vous' },
                    { userId: 'u-shira', displayName: 'Shira' },
                    { userId: 'u-or', displayName: 'Or' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
        ],
    },
    es: {
        you: 'Tú',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'Viaje a Barcelona',
                description: 'Verano 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-alex', displayName: 'Alex' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'Compañeros de piso',
                description: 'Piso compartido',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-maya', displayName: 'Maya' },
                    { userId: 'u-idan', displayName: 'Idan' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'Cena del viernes',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-noa', displayName: 'Noa' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'Fin de semana de esquí',
                description: 'Enero 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-rotem', displayName: 'Rotem' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'Equipo de oficina',
                description: 'Gastos del día a día',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-amit', displayName: 'Amit' },
                    { userId: 'u-liat', displayName: 'Liat' },
                    { userId: 'u-omri', displayName: 'Omri' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'Boda de Shira y Or',
                description: 'Un fin de semana',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Tú' },
                    { userId: 'u-shira', displayName: 'Shira' },
                    { userId: 'u-or', displayName: 'Or' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
        ],
    },
    de: {
        you: 'Du',
        groups: [
            {
                id: BASE_IDS.barcelona,
                name: 'Barcelona-Reise',
                description: 'Sommer 2026',
                groupType: 'trip',
                defaultCurrency: 'EUR',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-alex', displayName: 'Alex' },
                ],
            },
            {
                id: BASE_IDS.roommates,
                name: 'Mitbewohner',
                description: 'Gemeinsame Wohnung',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-maya', displayName: 'Maya' },
                    { userId: 'u-idan', displayName: 'Idan' },
                ],
            },
            {
                id: BASE_IDS.shabbat,
                name: 'Freitagabendessen',
                description: '',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-noa', displayName: 'Noa' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
            {
                id: BASE_IDS.ski,
                name: 'Skiwochenende im Norden',
                description: 'Januar 2026',
                groupType: 'trip',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-dana', displayName: 'Dana' },
                    { userId: 'u-yoni', displayName: 'Yoni' },
                    { userId: 'u-rotem', displayName: 'Rotem' },
                ],
            },
            {
                id: BASE_IDS.office,
                name: 'Büroteam',
                description: 'Alltägliche Ausgaben',
                groupType: 'home',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-amit', displayName: 'Amit' },
                    { userId: 'u-liat', displayName: 'Liat' },
                    { userId: 'u-omri', displayName: 'Omri' },
                ],
            },
            {
                id: BASE_IDS.wedding,
                name: 'Hochzeit von Shira und Or',
                description: 'Ein Wochenende',
                groupType: 'event',
                defaultCurrency: 'ILS',
                members: [
                    { userId: CAPTURE_USER_ID, displayName: 'Du' },
                    { userId: 'u-shira', displayName: 'Shira' },
                    { userId: 'u-or', displayName: 'Or' },
                    { userId: 'u-gal', displayName: 'Gal' },
                ],
            },
        ],
    },
};

function normalizeLanguage(lang: string): Language {
    const base = lang.split('-')[0] as Language;
    if (base in COPY) return base;
    return 'en';
}

function buildGroupRow(
    g: LocaleCopy['groups'][number],
    index: number,
): GroupWithMembers {
    const created = new Date('2026-06-01');
    created.setDate(created.getDate() - index * 12);
    const updated = new Date('2026-10-01');
    updated.setDate(updated.getDate() - index * 5);
    return {
        id: g.id,
        name: g.name,
        description: g.description,
        groupType: g.groupType,
        defaultCurrency: g.defaultCurrency,
        inviteToken: `invite-${g.id}`,
        createdBy: CAPTURE_USER_ID,
        isActive: true,
        createdAt: created,
        updatedAt: updated,
        lastActivityAt: updated,
        isArchivedByMe: false,
        isAutoArchived: false,
        hasUnreadNote: false,
        members: g.members.map(m => ({ ...m, isActive: true })),
    };
}

export function buildCaptureGroupsForLanguage(lang: string): GroupWithMembers[] {
    const copy = COPY[normalizeLanguage(lang)];
    return copy.groups.map((g, index) => buildGroupRow(g, index));
}

export function buildCaptureSimplifiedInputsForLanguage(lang: string): SimplifiedInputsPayload {
    const copy = COPY[normalizeLanguage(lang)];

    return {
        groups: [
            {
                groupId: BASE_IDS.barcelona,
                members: copy.groups[0].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'EUR',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: 85.5 },
                            { userId: 'u-dana', net: -40 },
                            { userId: 'u-yoni', net: -25.5 },
                            { userId: 'u-alex', net: -20 },
                        ],
                    },
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: 120 },
                            { userId: 'u-dana', net: -120 },
                            { userId: 'u-yoni', net: 0 },
                            { userId: 'u-alex', net: 0 },
                        ],
                    },
                ],
            },
            {
                groupId: BASE_IDS.roommates,
                members: copy.groups[1].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: -85 },
                            { userId: 'u-maya', net: 42.5 },
                            { userId: 'u-idan', net: 42.5 },
                        ],
                    },
                ],
            },
            {
                groupId: BASE_IDS.shabbat,
                members: copy.groups[2].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: 0 },
                            { userId: 'u-noa', net: 0 },
                            { userId: 'u-gal', net: 0 },
                        ],
                    },
                ],
            },
            {
                groupId: BASE_IDS.ski,
                members: copy.groups[3].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: 62 },
                            { userId: 'u-dana', net: -20 },
                            { userId: 'u-yoni', net: -22 },
                            { userId: 'u-rotem', net: -20 },
                        ],
                    },
                ],
            },
            {
                groupId: BASE_IDS.office,
                members: copy.groups[4].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: -34 },
                            { userId: 'u-amit', net: 12 },
                            { userId: 'u-liat', net: 11 },
                            { userId: 'u-omri', net: 11 },
                        ],
                    },
                ],
            },
            {
                groupId: BASE_IDS.wedding,
                members: copy.groups[5].members.map(m => ({
                    userId: m.userId,
                    name: m.displayName,
                    avatarUrl: null,
                })),
                currencies: [
                    {
                        currency: 'ILS',
                        nets: [
                            { userId: CAPTURE_USER_ID, net: 45 },
                            { userId: 'u-shira', net: -15 },
                            { userId: 'u-or', net: -15 },
                            { userId: 'u-gal', net: -15 },
                        ],
                    },
                ],
            },
        ],
    };
}

export function captureDisplayNameForUser(lang: string, userId: string): string {
    const copy = COPY[normalizeLanguage(lang)];
    if (userId === CAPTURE_USER_ID) return copy.you;
    for (const g of copy.groups) {
        const m = g.members.find(x => x.userId === userId);
        if (m) return m.displayName;
    }
    return userId;
}

export function barcelonaGroupNameForLanguage(lang: string): string {
    return COPY[normalizeLanguage(lang)].groups[0].name;
}
