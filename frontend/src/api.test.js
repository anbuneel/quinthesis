/**
 * Tests for api.js SSE parsing and streaming.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, setTokens, clearTokens } from './api'

// Helper to create a ReadableStream from chunks
function createMockStream(chunks) {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        const chunk = chunks[index]
        controller.enqueue(new TextEncoder().encode(chunk))
        index++
      } else {
        controller.close()
      }
    }
  })
}

// Helper to create mock Response with streaming body
function createMockResponse(chunks, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: createMockStream(chunks),
    json: () => Promise.resolve({ detail: 'Error' }),
  }
}

describe('api.sendMessageStream', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    // Set up a valid token
    setTokens('test-access-token', 'test-refresh-token')
  })

  afterEach(() => {
    global.fetch = originalFetch
    clearTokens()
  })

  describe('SSE parsing', () => {
    it('parses complete SSE events correctly', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"stage1_start"}\n',
          'data: {"type":"stage1_complete","data":[{"model":"gpt-4","response":"Hello"}]}\n',
          'data: {"type":"complete"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('stage1_start')
      expect(events[1].type).toBe('stage1_complete')
      expect(events[1].data.data[0].model).toBe('gpt-4')
      expect(events[2].type).toBe('complete')
    })

    it('handles events split across multiple chunks', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      // Event split across two chunks
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"stage1_',  // First half
          'start"}\n',                // Second half
          'data: {"type":"complete"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('stage1_start')
      expect(events[1].type).toBe('complete')
    })

    it('handles multiple events in a single chunk', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"stage1_start"}\ndata: {"type":"stage1_complete","data":[]}\ndata: {"type":"stage2_start"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(3)
      expect(events[0].type).toBe('stage1_start')
      expect(events[1].type).toBe('stage1_complete')
      expect(events[2].type).toBe('stage2_start')
    })

    it('handles final event without trailing newline', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"stage1_start"}\n',
          'data: {"type":"complete"}',  // No trailing newline
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('stage1_start')
      expect(events[1].type).toBe('complete')
    })

    it('ignores empty lines and non-data lines', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          '\n',                          // Empty line
          ':\n',                         // SSE comment (keepalive)
          'data: {"type":"start"}\n',
          '\n',
          'data: {"type":"end"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('start')
      expect(events[1].type).toBe('end')
    })

    it('handles UTF-8 content correctly', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"test","content":"日本語テスト 🎉"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(1)
      expect(events[0].data.content).toBe('日本語テスト 🎉')
    })

    it('continues parsing after malformed JSON event', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"start"}\n',
          'data: {invalid json}\n',     // Malformed
          'data: {"type":"end"}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(2)
      expect(events[0].type).toBe('start')
      expect(events[1].type).toBe('end')
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to parse SSE event:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })

    it('handles partial UTF-8 sequences split across chunks', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      // The emoji 🎉 is 4 bytes in UTF-8: F0 9F 8E 89
      // We split it across chunks to test the TextDecoder stream mode
      const emoji = '🎉'
      const encoder = new TextEncoder()
      const emojiBytes = encoder.encode(emoji)

      // Create chunks that split the emoji
      const prefix = encoder.encode('data: {"type":"test","content":"')
      const suffix = encoder.encode('"}\n')

      // Build response with raw byte manipulation
      const chunk1 = new Uint8Array([...prefix, emojiBytes[0], emojiBytes[1]])
      const chunk2 = new Uint8Array([emojiBytes[2], emojiBytes[3], ...suffix])

      // Custom stream that returns our byte arrays
      let index = 0
      const chunks = [chunk1, chunk2]
      const stream = new ReadableStream({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(chunks[index])
            index++
          } else {
            controller.close()
          }
        }
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
      })

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      expect(events).toHaveLength(1)
      expect(events[0].data.content).toBe('🎉')
    })
  })

  describe('error handling', () => {
    it('throws on HTTP error with detail from response', async () => {
      const onEvent = vi.fn()

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: () => Promise.resolve({ detail: 'Insufficient balance' }),
      })

      await expect(
        api.sendMessageStream('conv-123', 'Test', onEvent)
      ).rejects.toThrow('Failed to send message: Insufficient balance')
    })

    it('throws on network error', async () => {
      const onEvent = vi.fn()

      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'))

      await expect(
        api.sendMessageStream('conv-123', 'Test', onEvent)
      ).rejects.toThrow('Network error: Network failure')
    })

    it('throws when not authenticated', async () => {
      clearTokens()
      const onEvent = vi.fn()

      await expect(
        api.sendMessageStream('conv-123', 'Test', onEvent)
      ).rejects.toThrow('Not authenticated')
    })
  })

  describe('event types', () => {
    it('correctly passes all event types from server', async () => {
      const events = []
      const onEvent = (type, data) => events.push({ type, data })

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse([
          'data: {"type":"stage1_start"}\n',
          'data: {"type":"stage1_complete","data":[]}\n',
          'data: {"type":"stage2_start"}\n',
          'data: {"type":"stage2_complete","data":[],"metadata":{}}\n',
          'data: {"type":"stage3_start"}\n',
          'data: {"type":"stage3_complete","data":{}}\n',
          'data: {"type":"title_complete","data":{"title":"Test Title"}}\n',
          'data: {"type":"error","message":"Test error"}\n',
          'data: {"type":"complete","cost":{"total_cost":0.05}}\n',
        ])
      )

      await api.sendMessageStream('conv-123', 'Test', onEvent)

      const types = events.map(e => e.type)
      expect(types).toEqual([
        'stage1_start',
        'stage1_complete',
        'stage2_start',
        'stage2_complete',
        'stage3_start',
        'stage3_complete',
        'title_complete',
        'error',
        'complete',
      ])

      // Verify specific event data
      const titleEvent = events.find(e => e.type === 'title_complete')
      expect(titleEvent.data.data.title).toBe('Test Title')

      const completeEvent = events.find(e => e.type === 'complete')
      expect(completeEvent.data.cost.total_cost).toBe(0.05)
    })
  })
})

describe('api.testCredentials', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    clearTokens()
  })

  it('returns false when no token is set', async () => {
    clearTokens()
    const result = await api.testCredentials()
    expect(result).toBe(false)
  })

  it('returns true when authenticated', async () => {
    setTokens('valid-token', 'refresh-token')
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    const result = await api.testCredentials()
    expect(result).toBe(true)
  })

  it('returns false when API returns error', async () => {
    setTokens('invalid-token', 'refresh-token')
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })

    const result = await api.testCredentials()
    expect(result).toBe(false)
  })
})
