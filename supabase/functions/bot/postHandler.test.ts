import { handleDailyPost } from "./postHandler.ts";

// Мокаем supabase-js
const mockInsert = jest.fn();
jest.mock("jsr:@supabase/supabase-js@2.39.7", () => ({
  createClient: () => ({ from: () => ({ insert: mockInsert }) })
}));

describe("handleDailyPost", () => {
  beforeEach(() => {
    mockInsert.mockReset();
  });

  it("игнорирует сообщение без текста", async () => {
    await handleDailyPost({});
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("игнорирует сообщение без #daily", async () => {
    await handleDailyPost({ text: "Привет!", from: { id: 1 } });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("сохраняет пост с #daily", async () => {
    mockInsert.mockResolvedValueOnce({ error: null });
    await handleDailyPost({ text: "#daily", from: { id: 42 } });
    expect(mockInsert).toHaveBeenCalledWith({ user_id: 42, date: expect.any(String) });
  });

  it("логирует ошибку при ошибке вставки", async () => {
    const error = { message: "fail" };
    mockInsert.mockResolvedValueOnce({ error });
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    await handleDailyPost({ text: "#daily", from: { id: 99 } });
    expect(spy).toHaveBeenCalledWith("Ошибка при сохранении поста:", "fail");
    spy.mockRestore();
  });
}); 