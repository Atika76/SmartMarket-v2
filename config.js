// SmartMarket - Supabase + Gemini konfiguráció
window.__CONFIG__ = {
  SUPABASE_URL: "https://mvtjyxyzdwfngzucbwoy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12dGp5eHlkendmbmd6dWNid295Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzMTk1NDEsImV4cCI6MjA3NTg5NTU0MX0.vPVuiMRcEFIemX36NOm-_e1PRNs8YGKAvVGIQP4u7oY",

  // 📸 Storage bucket név — fontos, hogy Supabase-ben is létezzen és public legyen
  BUCKET: "hirdetes-kepek",

  // 🤖 Gemini AI kulcs (Generative Language API)
  GEMINI_KEY: "AIzaSyC8-cu3m5T6pOZGQjwgnM4yFWac0-qNbCU",

  // 🌐 Edge Function URL (gemini-proxy)
  EDGE_FUNCTION_URL: "https://mvtjyxyzdwfngzucbwoy.supabase.co/functions/v1/gemini-proxy"
};
