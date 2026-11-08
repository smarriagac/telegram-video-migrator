import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { BigMediaUploadModal } from "../components/BigMediaUploadModal";
import { bigMediaUploadApi } from "../../infrastructure/bigMediaUploadApi";

vi.mock("../../infrastructure/bigMediaUploadApi", () => ({
  bigMediaUploadApi: {
    uploadFileResumable: vi.fn(),
    cancelUpload: vi.fn(),
    getStatus: vi.fn(),
  },
}));

describe("BigMediaUploadModal Component", () => {
  const onCloseMock = vi.fn();
  const onUploadSuccessMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with dropzone when open", () => {
    render(
      <BigMediaUploadModal
        isOpen={true}
        onClose={onCloseMock}
        targetChannelId={-100123456789}
        targetChannelTitle="Canal de Películas HD"
      />
    );

    expect(screen.getByText(/Subida Chonkeada Resumible/)).toBeInTheDocument();
    expect(screen.getByText("Canal de Películas HD")).toBeInTheDocument();
    expect(screen.getByText(/Arrastrá tu archivo o hacé clic para explorar/)).toBeInTheDocument();
  });

  it("displays file info and chunking badge when file is selected", async () => {
    render(
      <BigMediaUploadModal
        isOpen={true}
        onClose={onCloseMock}
        targetChannelId={-100123456789}
        targetChannelTitle="Canal de Películas HD"
      />
    );

    const file = new File(["dummy video data " .repeat(1000000)], "movie_2gb_edition.mp4", {
      type: "video/mp4",
    });

    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("movie_2gb_edition.mp4")).toBeInTheDocument();
      expect(screen.getByText("Chunking 5MB")).toBeInTheDocument();
      expect(screen.getByText("Iniciar Subida Chonkeada")).toBeEnabled();
    });
  });

  it("invokes uploadFileResumable on start click", async () => {
    (bigMediaUploadApi.uploadFileResumable as any).mockImplementation(
      async (_file: any, _params: any, onProgress: any) => {
        onProgress({
          percent: 50,
          speedMbps: 25.5,
          etaSeconds: 12,
          uploadedBytes: 1048576,
          totalBytes: 2097152,
          currentChunk: 1,
          totalChunks: 2,
          phase: "TRANSMITTING",
        });
        return {
          success: true,
          upload_id: "test-uuid-1234",
          message_id: 8888,
          channel_id: -100123456789,
          file_size: 2097152,
        };
      }
    );

    render(
      <BigMediaUploadModal
        isOpen={true}
        onClose={onCloseMock}
        targetChannelId={-100123456789}
        targetChannelTitle="Canal de Películas HD"
        onUploadSuccess={onUploadSuccessMock}
      />
    );

    const file = new File(["test video payload"], "sample.mp4", { type: "video/mp4" });
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Iniciar Subida Chonkeada")).toBeEnabled();
    });

    fireEvent.click(screen.getByText("Iniciar Subida Chonkeada"));

    await waitFor(() => {
      expect(bigMediaUploadApi.uploadFileResumable).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/¡Archivo transmitido con éxito!/)).toBeInTheDocument();
      expect(onUploadSuccessMock).toHaveBeenCalledTimes(1);
    });
  });

  it("handles cancel action and resets state", async () => {
    render(
      <BigMediaUploadModal
        isOpen={true}
        onClose={onCloseMock}
        targetChannelId={-100123456789}
      />
    );

    const file = new File(["test"], "sample.mp4", { type: "video/mp4" });
    const fileInput = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("sample.mp4")).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", { name: "" }); // the X button
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(screen.queryByText("sample.mp4")).not.toBeInTheDocument();
    });
  });
});
