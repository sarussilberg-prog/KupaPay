/**
 * FeedRowCard — the white card frame used by activity feed rows.
 * Accepts pre-formatted display strings; data shaping happens in the caller.
 */

import React from 'react';
import { View, TouchableOpacity, TextStyle } from 'react-native';
import { Text } from './AppText';
import { useRtlLayout, rtlRowStyle } from '../hooks/useRtlLayout';
import {
    FEED_AMOUNT_COLUMN_MIN_WIDTH,
    FEED_AMOUNT_CURRENCY_WIDTH,
    scaleAmountValueFontSize,
} from '../lib/feedAmountLayout';

export {
    FEED_AMOUNT_COLUMN_MIN_WIDTH,
    FEED_AMOUNT_CURRENCY_WIDTH,
} from '../lib/feedAmountLayout';

const LTR_AMOUNT_STYLE: TextStyle = {
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
};

function splitAmountString(amount: string): { currency: string; value: string } {
    const space = amount.indexOf(' ');
    if (space === -1) return { currency: amount, value: '' };
    return {
        currency: amount.slice(0, space),
        value: amount.slice(space + 1),
    };
}

export function FeedAmountLine({
    amount,
    className,
    baseFontSize = 15,
}: {
    amount: string;
    className: string;
    /** Matches the px size in className (e.g. 11 for sub-lines). */
    baseFontSize?: number;
}) {
    const { currency, value } = splitAmountString(amount);
    const valueFontSize = scaleAmountValueFontSize(value, baseFontSize);

    return (
        <View
            style={{
                flexDirection: 'row',
                width: '100%',
                flexWrap: 'nowrap',
                alignItems: 'center',
            }}
        >
            <Text
                className={className}
                numberOfLines={1}
                style={[
                    LTR_AMOUNT_STYLE,
                    {
                        width: FEED_AMOUNT_CURRENCY_WIDTH,
                        textAlign: 'left',
                        flexShrink: 0,
                    },
                ]}
            >
                {currency}
            </Text>
            <Text
                className={className}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
                style={[
                    LTR_AMOUNT_STYLE,
                    {
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        fontSize: valueFontSize,
                        flexShrink: 1,
                    },
                ]}
            >
                {value}
            </Text>
        </View>
    );
}

/** Sits between the main amount and the user's share — aligned under the numeric column. */
export function FeedInvolvementLabel({ label }: { label: string }) {
    const isRtl = useRtlLayout();
    return (
        <Text
            className="text-[11px] font-medium text-gray-500"
            style={{
                width: '100%',
                textAlign: 'left',
                paddingLeft: FEED_AMOUNT_CURRENCY_WIDTH,
                writingDirection: isRtl ? 'rtl' : 'ltr',
            }}
            numberOfLines={1}
        >
            {label}
        </Text>
    );
}

interface FeedRowCardProps {
    thumbnail: React.ReactNode;
    title: string;
    meta: string;
    amount: string;
    /** Tailwind color class for the main amount (viewer-net tone). Defaults to black. */
    amountClassName?: string;
    subLine?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
}

export function FeedRowCard({
    thumbnail,
    title,
    meta,
    amount,
    amountClassName = 'text-gray-900',
    subLine,
    onPress,
    testID,
}: FeedRowCardProps) {
    const isRtl = useRtlLayout();

    const body = (
        <>
            {thumbnail}
            <View className="flex-1 min-w-0">
                <Text
                    className="text-[15px] font-semibold text-gray-900"
                    numberOfLines={1}
                >
                    {title}
                </Text>
                <Text
                    className="text-[11px] text-gray-400 mt-0.5"
                    numberOfLines={1}
                >
                    {meta}
                </Text>
            </View>
            <View
                style={{
                    flexShrink: 0,
                    minWidth: FEED_AMOUNT_COLUMN_MIN_WIDTH,
                    direction: 'ltr',
                }}
            >
                <FeedAmountLine
                    amount={amount}
                    className={`text-[15px] font-bold ${amountClassName}`}
                />
                {subLine ? (
                    typeof subLine === 'string' ? (
                        <Text
                            className="text-[11px] font-medium text-gray-500 mt-0.5"
                            style={[
                                LTR_AMOUNT_STYLE,
                                { width: '100%', textAlign: 'left' },
                            ]}
                        >
                            {subLine}
                        </Text>
                    ) : (
                        <View style={{ width: '100%', marginTop: 2 }}>
                            {subLine}
                        </View>
                    )
                ) : null}
            </View>
        </>
    );

    const className = "bg-white rounded-2xl border border-gray-100 px-3.5 py-3 mb-2 items-center";
    const style = { gap: 12, ...rtlRowStyle(isRtl) };

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                testID={testID}
                className={className}
                style={style}
            >
                {body}
            </TouchableOpacity>
        );
    }

    return (
        <View testID={testID} className={className} style={style}>
            {body}
        </View>
    );
}
