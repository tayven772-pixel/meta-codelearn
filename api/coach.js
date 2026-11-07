export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    message = '',
    level = 'Beginner',
    language = 'English',
    track = 'Coding',
    project = null,
    history = [],
    activeFile = '',
  } = req.body || {};

  const trimmed = String(message).trim();
  if (!trimmed) return res.status(400).json({ error: 'Message is required.' });

  const safeHistory = Array.isArray(history)
    ? history.slice(-12).map((item) => ({
        role: item?.role === 'assistant' ? 'assistant' : 'user',
        content: String(item?.content || '').slice(0, 2000),
      }))
    : [];

  const projectContext = project
    ? '\nCurrent project workspace: ' + JSON.stringify({
        name: project.name,
        type: project.type,
        activeFile: String(activeFile || ''),
        files: project.files || {},
      }).slice(0, 24000)
    : '';

  const conversationContext = safeHistory.length
    ? '\nRecent conversation: ' + JSON.stringify(safeHistory).slice(0, 12000)
    : '';

  const ollamaConfigured = Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL);
  if (!ollamaConfigured && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Meta AI is not configured on the server.' });
  }

  const systemPrompt =
    String(track) === 'Project Builder'
      ? (
          'You are Meta Project Agent inside a coding project workspace. ' +
          'You can create and update starter project files. Respond ONLY with valid JSON and no markdown fences. ' +
          'Use this exact shape: {"reply":"short helpful message","project":{"name":"project name","type":"Website|Game|App|Roblox|MCBE|MCJE|MCJE Mod|Blank","files":{"path/file.ext":"full file content"}}}. ' +
          'When no project exists, infer a useful project name/type and create a small runnable starter. ' +
          'When a project exists, inspect its files before answering. Preserve existing files unless the requested change requires edits, and return the complete current file map after edits. ' +
          'Use the recent conversation to understand follow-up requests. If an active file is provided, treat it as the file the learner is currently viewing. ' +
          'Actually implement requested coding changes in the returned files instead of only explaining what to do. ' +
          'Keep projects reasonably small and safe. Do not claim a file exists unless it is included in files.'
        )
      : String(track) === 'Discord Support'
        ? (
            'You are Meta Support AI inside the Meta Discord server. ' +
            'Answer members clearly and briefly using only information present in the conversation context or generally safe Discord guidance. ' +
            'Do not invent server-specific rules, IPs, links, roles, prices, or policies. If server-specific information is missing, say you are not sure and ask staff to confirm. ' +
            'Be helpful with tickets, account/site questions, coding questions, and basic server support. ' +
            'If a member asks to close a ticket, tell them to use the Close button unless the bot has an explicit close action available.'
          )
        : (
            'You are Meta Coach, a friendly coding tutor inside the Meta learning website. ' +
            'Teach rather than simply dumping final answers. Adapt to the learner level. ' +
            'Give concise explanations, useful examples, debugging help, and next steps. ' +
            'For coding questions, preserve the user\'s existing approach when possible. ' +
            'The learner level is ' + String(level) + ', the selected track is ' + String(track) +
            ', and the preferred language is ' + String(language) + '.'
          );

  try {
    let text = '';

    if (ollamaConfigured) {
      const baseUrl = String(process.env.OLLAMA_BASE_URL || '').trim().replace(/\/+$/, '');
      const model = String(process.env.OLLAMA_MODEL || '').trim();
      let endpoint;
      try {
        endpoint = new URL(baseUrl);
        if (!['http:', 'https:'].includes(endpoint.protocol) ||
            (endpoint.protocol === 'http:' && !['127.0.0.1', 'localhost', '::1'].includes(endpoint.hostname))) {
          return res.status(500).json({ error: 'Ollama must use HTTPS or a loopback address.' });
        }
      } catch {
        return res.status(500).json({ error: 'The Ollama server URL is invalid.' });
      }

      const ollamaResponse = await fetch(new URL(`${baseUrl}/chat/completions`), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.OLLAMA_API_KEY ? { authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...safeHistory,
            { role: 'user', content: trimmed + projectContext },
          ],
          temperature: 0.4,
          stream: false,
        }),
        signal: AbortSignal.timeout(180000),
      });
      const ollamaData = await ollamaResponse.json().catch(() => null);
      if (!ollamaResponse.ok) {
        console.error('Ollama coach request failed:', ollamaResponse.status);
        return res.status(502).json({ error: 'Meta AI could not get a response from Ollama. Check that the service and model are available.' });
      }
      text = ollamaData?.choices?.[0]?.message?.content || '';
    } else {
      const aiResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.6-sol',
          instructions: systemPrompt,
          input: trimmed + conversationContext + projectContext,
        }),
        signal: AbortSignal.timeout(180000),
      });

      const data = await aiResponse.json().catch(() => null);
      if (!aiResponse.ok) {
        console.error('OpenAI coach request failed:', aiResponse.status);
        return res.status(502).json({ error: 'Meta Coach could not reach the AI service.' });
      }
      text =
        data?.output_text ||
        data?.output?.flatMap((item) => item.content || [])
          ?.find((item) => item.type === 'output_text')?.text ||
        '';
    }

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(502).json({ error: 'Meta AI received an empty or unsupported response.' });
    }

    if (String(track) === 'Project Builder') {
      try {
        const parsed = JSON.parse(String(text).trim());
        return res.status(200).json({
          reply: String(parsed.reply || 'Project updated.'),
          project: {
            name: String(parsed.project?.name || project?.name || 'AI Project'),
            type: String(parsed.project?.type || project?.type || 'Blank'),
            files: parsed.project?.files && typeof parsed.project.files === 'object'
              ? parsed.project.files
              : (project?.files || {}),
          },
        });
      } catch {
        console.error('Meta Project Agent returned a response that was not valid project JSON.');
        return res.status(200).json({
          reply: String(text || 'Project updated.'),
          project: project || { name: 'AI Project', type: 'Blank', files: {} },
        });
      }
    }

    return res.status(200).json({ reply: text });
  } catch (error) {
    console.error('Meta Coach AI error:', error?.name || 'unknown error');
    return res.status(502).json({ error: 'Meta AI is temporarily unavailable. Check the Ollama service and try again.' });
  }
}
