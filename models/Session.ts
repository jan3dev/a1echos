export interface Session {
  id: string;
  name: string;
  timestamp: Date;
  lastModified: Date;
  isIncognito: boolean;
}

export interface SessionJSON {
  id: string;
  name: string;
  timestamp: string;
  lastModified?: string;
  isIncognito?: boolean;
}

export const sessionToJSON = (session: Session): SessionJSON => {
  return {
    id: session.id,
    name: session.name,
    timestamp: session.timestamp.toISOString(),
    lastModified: session.lastModified.toISOString(),
    isIncognito: session.isIncognito,
  };
};

export const sessionFromJSON = (json: SessionJSON): Session => {
  return {
    id: json.id,
    name: json.name,
    timestamp: new Date(json.timestamp),
    lastModified: json.lastModified
      ? new Date(json.lastModified)
      : new Date(json.timestamp),
    isIncognito: json.isIncognito ?? false,
  };
};

export const createSession = (params: {
  id: string;
  name: string;
  timestamp: Date;
  lastModified?: Date;
  isIncognito?: boolean;
}): Session => {
  return {
    id: params.id,
    name: params.name,
    timestamp: params.timestamp,
    lastModified: params.lastModified ?? params.timestamp,
    isIncognito: params.isIncognito ?? false,
  };
};
