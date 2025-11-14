export interface Transcription {
  id: string;
  sessionId: string;
  text: string;
  timestamp: Date;
  audioPath: string;
}

export interface TranscriptionJSON {
  id: string;
  sessionId: string;
  text: string;
  timestamp: string;
  audioPath: string;
}

export const transcriptionToJSON = (transcription: Transcription): TranscriptionJSON => {
  return {
    id: transcription.id,
    sessionId: transcription.sessionId,
    text: transcription.text,
    timestamp: transcription.timestamp.toISOString(),
    audioPath: transcription.audioPath,
  };
};

export const transcriptionFromJSON = (json: TranscriptionJSON): Transcription => {
  const parsedDate = new Date(json.timestamp);
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid timestamp: ${json.timestamp}`);
  }

  return {
    id: json.id,
    sessionId: json.sessionId ?? 'default_session',
    text: json.text,
    timestamp: parsedDate,
    audioPath: json.audioPath,
  };
};

export const createTranscription = (params: {
  id: string;
  sessionId?: string;
  text: string;
  timestamp: Date;
  audioPath: string;
}): Transcription => {
  return {
    id: params.id,
    sessionId: params.sessionId ?? 'default_session',
    text: params.text,
    timestamp: params.timestamp,
    audioPath: params.audioPath,
  };
};


