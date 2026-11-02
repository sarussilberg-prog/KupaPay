import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import { useLayoutWindowWidth } from '../../hooks/useLayoutWindowWidth';
import { isE2eLayoutProbeEnabled } from '../../lib/e2eLayoutProbes';
import {
    allChecksPass,
    buildDiagnosticPayload,
    diagnosticJson,
    subscribeLayoutDiagnostics,
    type GroupsLayoutDiagnosticPayload,
} from '../../lib/groupsLayoutDiagnostics';

/**
 * Hidden payload for Maestro + CI: encodes measured frames and pass/fail checks.
 * When checks pass, exposes `groups-layout-diagnostics-ok`; otherwise only the JSON text id.
 */
export function GroupsLayoutDiagnosticsReporter() {
    const { i18n } = useTranslation();
    const isRtl = useRtlLayout();
    const windowWidth = useLayoutWindowWidth();
    const [payload, setPayload] = useState<GroupsLayoutDiagnosticPayload>(() =>
        buildDiagnosticPayload(i18n.language, isRtl, windowWidth),
    );

    useEffect(() => {
        if (!isE2eLayoutProbeEnabled()) return undefined;
        return subscribeLayoutDiagnostics(() => {
            const next = buildDiagnosticPayload(i18n.language, isRtl, windowWidth);
            setPayload(next);
            // Metro / Maestro log capture for CI artifact extraction
            console.log('[LAYOUT_DIAG_JSON]', diagnosticJson(next));
        });
    }, [i18n.language, isRtl, windowWidth]);

    if (!isE2eLayoutProbeEnabled()) return null;

    const json = diagnosticJson(payload);
    const ok = allChecksPass(payload.checks);

    // Maestro on iOS cannot see testIDs hidden from the accessibility tree (0×0 + hidden).
    const probeStyle = {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        opacity: 0.01,
    };

    return (
        <>
            <Text testID="groups-layout-diagnostics-json" accessible style={probeStyle}>
                {json}
            </Text>
            {ok ? (
                <Text testID="groups-layout-diagnostics-ok" accessible style={probeStyle}>
                    ok
                </Text>
            ) : null}
        </>
    );
}
