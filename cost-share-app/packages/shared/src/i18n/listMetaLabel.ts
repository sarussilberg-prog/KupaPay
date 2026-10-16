/**
 * List-row meta labels (member count · updated) — keep counts glued to the following word.
 */

/** Replace the first space after a leading number with NBSP so "2 חברים" does not wrap mid-phrase. */
export function bindCountLabelNoBreak(label: string): string {
    return label.replace(
        /^([\d\u0660-\u0669\u06F0-\u06F9][\d\u0660-\u0669\u06F0-\u06F9.,]*)\s+/u,
        '$1\u00A0',
    );
}
