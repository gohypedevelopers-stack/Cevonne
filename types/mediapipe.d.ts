export {};

declare global {
  interface MediaPipeLandmark {
    x: number;
    y: number;
    z?: number;
    visibility?: number;
    score?: number;
  }

  interface MediaPipeFaceMeshResults {
    multiFaceLandmarks?: MediaPipeLandmark[][];
  }

  interface MediaPipeHandsResults {
    multiHandLandmarks?: MediaPipeLandmark[][];
  }

  interface MediaPipeFaceMeshOptions {
    locateFile: (file: string) => string;
  }

  interface MediaPipeHandsOptions {
    locateFile: (file: string) => string;
  }

  interface MediaPipeController<TResults> {
    setOptions(options: Record<string, unknown>): void;
    onResults(callback: (results: TResults) => void): void;
    send?(input: unknown): Promise<void> | void;
    close?(): void;
  }

  interface Window {
    FaceMesh?: new (options: MediaPipeFaceMeshOptions) => MediaPipeController<MediaPipeFaceMeshResults>;
    Hands?: new (options: MediaPipeHandsOptions) => MediaPipeController<MediaPipeHandsResults>;
  }
}
