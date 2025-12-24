# Project Future Improvements

## Chat/AI Assistant Enhancements

### High Priority
- **Chat Persistence** - Remember conversation history within a single session
  - Messages should persist even when switching tabs
  - History maintained until explicit clear or session end

### Medium Priority  
- **System Prompt Setting** - Allow users to set custom system prompts for the chat assistant
  - Persist through shutdowns/restarts
  - Configurable via settings UI

- **Reasoning Mode Toggle** - For models that support it (like gpt-oss-120B)
  - Enable/disable extended reasoning
  - Show reasoning steps optionally

### Lower Priority
- **File Upload Support**
  - Text files (.txt, .md, .json, .yaml, .env)
  - Images (.png, .jpg) for chart analysis
  - Code files (.js, .ts, .py, .bat, .vbs, .html, .css)
  - Log files for analysis
  - Potentially .zip archives

---

## Dashboard Enhancements

### High Priority
- **Manual Position Management**
  - Close positions manually from dashboard
  - Open positions manually with specified parameters
  - Emergency close all positions button

- **Live Micro-Analysis View**
  - Real-time detailed logging of AI decision process
  - Visual indicators of analysis steps
  - More understandable format than raw logs

### Medium Priority
- **Performance Charts**
  - Detailed P&L history graphs
  - Win/loss streaks visualization
  - Per-coin performance breakdown

- **Alert System**
  - Configurable alerts for significant events
  - Desktop notifications
  - Sound alerts option

---

## Bot Core Improvements

### Trading Logic
- Improve AI response parsing robustness
- Better handling of truncated JSON responses
- More detailed trade reasoning logs

### Risk Management
- Position sizing optimization
- Dynamic stop-loss adjustment
- Correlation-aware position limits

---

*Last updated: December 2024*
