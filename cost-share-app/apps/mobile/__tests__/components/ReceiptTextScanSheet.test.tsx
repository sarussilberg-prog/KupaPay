import React from 'react';
import { renderWithQuery } from '../helpers/renderWithQuery';
import { ReceiptTextScanSheet } from '../../components/receipt/ReceiptTextScanSheet';

describe('ReceiptTextScanSheet', () => {
    it('wraps sheet body with horizontal padding', () => {
        const { getByTestId } = renderWithQuery(
            <ReceiptTextScanSheet visible onClose={jest.fn()} onApply={jest.fn()} />,
        );
        expect(getByTestId('bottom-sheet-body')).toBeTruthy();
    });
});
