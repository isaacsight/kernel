// Visitor Notes - Landing Page Guestbook
// Uses existing Supabase client from config.js

(function () {
    'use strict';

    const NOTES_LIMIT = 10;
    let notesContainer = null;
    let noteForm = null;

    // Fetch and display recent notes
    async function fetchNotes() {
        if (!window.supabaseClient || !notesContainer) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('visitor_notes')
                .select('id, name, message, created_at')
                .order('created_at', { ascending: false })
                .limit(NOTES_LIMIT);

            if (error) throw error;

            renderNotes(data || []);
        } catch (err) {
            console.error('Error fetching notes:', err);
            notesContainer.innerHTML = '<p class="note-error">Could not load notes.</p>';
        }
    }

    // Render notes to the DOM
    function renderNotes(notes) {
        if (notes.length === 0) {
            notesContainer.innerHTML = '<p class="note-empty">No notes yet. Be the first!</p>';
            return;
        }

        notesContainer.innerHTML = notes.map(note => `
            <div class="note-card">
                <p class="note-message">${escapeHtml(note.message)}</p>
                <div class="note-meta">
                    <span class="note-author">${note.name ? escapeHtml(note.name) : 'Anonymous'}</span>
                    <span class="note-date">${formatDate(note.created_at)}</span>
                </div>
            </div>
        `).join('');
    }

    // Submit a new note
    async function submitNote(e) {
        e.preventDefault();
        if (!window.supabaseClient) return;

        const nameInput = noteForm.querySelector('#note-name');
        const messageInput = noteForm.querySelector('#note-message');
        const submitBtn = noteForm.querySelector('button[type="submit"]');

        const name = nameInput.value.trim().slice(0, 50);
        const message = messageInput.value.trim().slice(0, 280);

        if (!message) {
            messageInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const { error } = await window.supabaseClient
                .from('visitor_notes')
                .insert([{ name: name || null, message }]);

            if (error) throw error;

            // Clear form and refresh notes
            nameInput.value = '';
            messageInput.value = '';
            await fetchNotes();
        } catch (err) {
            console.error('Error submitting note:', err);
            alert('Could not submit note. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Leave a Note';
        }
    }

    // Helper: escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper: format date
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Initialize on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        notesContainer = document.getElementById('notes-list');
        noteForm = document.getElementById('note-form');

        if (notesContainer) {
            fetchNotes();
        }

        if (noteForm) {
            noteForm.addEventListener('submit', submitNote);
        }
    });
})();
