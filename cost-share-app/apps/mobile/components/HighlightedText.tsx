/**
 * HighlightedText — renders text with case-insensitive matches of `query` highlighted.
 */

import React from 'react';
import { TextProps } from 'react-native';
import { Text } from './AppText';

interface HighlightedTextProps extends TextProps {
    text: string;
    query?: string;
    className?: string;
    highlightClassName?: string;
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function HighlightedText({
    text,
    query,
    className,
    highlightClassName = 'bg-yellow-100 text-gray-900',
    ...rest
}: HighlightedTextProps) {
    const trimmed = (query ?? '').trim();
    if (!trimmed) {
        return (
            <Text className={className} {...rest}>
                {text}
            </Text>
        );
    }
    // Split with a capturing group → odd indices are the matches.
    const re = new RegExp(`(${escapeRegExp(trimmed)})`, 'i');
    const parts = text.split(re);
    return (
        <Text className={className} {...rest}>
            {parts.map((part, i) =>
                i % 2 === 1 ? (
                    <Text key={i} className={highlightClassName}>
                        {part}
                    </Text>
                ) : (
                    part
                ),
            )}
        </Text>
    );
}
