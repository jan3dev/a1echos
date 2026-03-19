import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import React from 'react';

import { InAppBanner } from './InAppBanner';

beforeEach(() => {
  jest.clearAllMocks();
  (Linking as any).canOpenURL = jest.fn(async () => true);
});

describe('InAppBanner', () => {
  it('has accessibility label "Download AQUA Wallet"', () => {
    const { getByLabelText } = render(<InAppBanner />);
    expect(getByLabelText('Download AQUA Wallet')).toBeTruthy();
  });

  it('has accessibility role "link"', () => {
    const { getByRole } = render(<InAppBanner />);
    expect(getByRole('link')).toBeTruthy();
  });

  it('press opens URL via Linking', async () => {
    const { getByRole } = render(<InAppBanner />);
    fireEvent.press(getByRole('link'));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalled();
    });
  });
});
