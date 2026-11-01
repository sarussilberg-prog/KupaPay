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
            setPayload(buildDiagnosticPayload(i18n.language, isRtl, windowWidth));
        });
    }, [i18n.language, isRtl, windowWidth]);

    if (!isE2eLayoutProbeEnabled()) return null;

    const json = diagnosticJson(payload);
    const ok = allChecksPass(payload.checks);

    return (
        <>
            <Text
                testID="groups-layout-diagnostics-json"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{ width: 0, height: 0, opacity: 0 }}
            >
                {json}
            </Text>
            {ok ? (
                <Text
                    testID="groups-layout-diagnostics-ok"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={{ width: 0, height: 0, opacity: 0 }}
                >
                    ok
                </Text>
            ) : null}
        </>
    );
}
