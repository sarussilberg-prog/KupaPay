import { Dimensions } from 'react-native';
import { syncGroupsListPreviewDimensions } from '../../dev/syncGroupsListPreviewDimensions';

describe('syncGroupsListPreviewDimensions', () => {
    it('sets window dimensions to the preview viewport width', () => {
        syncGroupsListPreviewDimensions(375);
        expect(Dimensions.get('window').width).toBe(375);
    });
});
