import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
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

    // Maestro iOS matches testID on native views in the a11y tree — use a small labeled View, not hidden Text.
    const probeStyle = {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        width: 4,
        height: 4,
        opacity: 0.02,
    };

    return (
        <>
            <View
                testID="groups-layout-diagnostics-json"
                accessible
                accessibilityLabel={json}
                importantForAccessibility="yes"
                collapsable={false}
                style={probeStyle}
            >
                <Text accessible={false}>{json}</Text>
            </View>
            {ok ? (
                <View
                    testID="groups-layout-diagnostics-ok"
                    accessible
                    accessibilityLabel="groups-layout-diagnostics-ok"
                    importantForAccessibility="yes"
                    collapsable={false}
                    style={probeStyle}
                >
                    <Text accessible={false}>ok</Text>
                </View>
            ) : null}
        </>
    );
}
