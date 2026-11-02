/**
 * Intentional row-reverse for rtlRowPatterns guard red/green proof — not imported by the app.
 */
import { View } from 'react-native';

export function RtlRowBadFixture() {
    return <View style={{ flexDirection: 'row-reverse' }} />;
}
