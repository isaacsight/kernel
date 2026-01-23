// Supabase Configuration
const SUPABASE_URL = 'https://kqsixkorzaulmeuynfkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtxc2l4a29yemF1bG1ldXluZmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NjI1OTMsImV4cCI6MjA3OTMzODU5M30.OyePb4F8mxS_p77iXpx751ufn60tvEHYRtvaehxRkB8';

// Initialize the client
// Initialize the client
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
