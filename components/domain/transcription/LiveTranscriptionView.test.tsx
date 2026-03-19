import { render } from '@testing-library/react-native';
import React from 'react';

import { LiveTranscriptionView } from './LiveTranscriptionView';

jest.mock('./TranscriptionList', () => ({
  TranscriptionList: (props: any) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { View } = require('react-native');
    return <View testID="transcription-list" {...props} />;
  },
}));

describe('LiveTranscriptionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders TranscriptionList with selectionMode=false', () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId('transcription-list');
    expect(list.props.selectionMode).toBe(false);
  });

  it('passes default padding values', () => {
    const { getByTestId } = render(<LiveTranscriptionView />);
    const list = getByTestId('transcription-list');
    expect(list.props.topPadding).toBe(0);
    expect(list.props.bottomPadding).toBe(16.0);
  });

  it('custom padding props forwarded', () => {
    const { getByTestId } = render(
      <LiveTranscriptionView topPadding={20} bottomPadding={40} />,
    );
    const list = getByTestId('transcription-list');
    expect(list.props.topPadding).toBe(20);
    expect(list.props.bottomPadding).toBe(40);
  });
});
