"use client";

import { useState, useEffect, useRef } from "react";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import {
  collection,
  query,
  startAt,
  endAt,
  orderBy,
  getDocs,
  limit
} from "firebase/firestore";
import { db } from "../lib/firebase";

type CommentInputProps = {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder?: string;
  className?: string; // Support custom styling for the input container
};

export function CommentInput({ value, onChange, onSend, sending, placeholder, className }: CommentInputProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null); // Can also be HTMLTextAreaElement if we want multiline
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Handle input changes and detect mentions
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const newPos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPosition(newPos);

    // Detect mention trigger
    // Look for @ followed by word chars up to cursor
    const textBeforeCursor = newValue.slice(0, newPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const searchTerm = mentionMatch[1].toLowerCase();
      // Only search if we have a term or just '@' (to show recent/all?) - user said "while typing"
      // Usually need at least 1 char to avoid massive queries, or just show randoms.
      // Let's require 1 char for now to be efficient.
      if (searchTerm.length >= 1) {
        try {

          const usersRef = collection(db, "users");
          // Prefix search: startAt(term) endAt(term + '\uf8ff')
          const q = query(
            usersRef,
            orderBy("username"),
            startAt(searchTerm),
            endAt(searchTerm + "\uf8ff"),
            limit(5)
          );

          const snapshot = await getDocs(q);
          const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          setSuggestions(users);
          setShowSuggestions(users.length > 0);
        } catch (err) {
          console.error("Error searching users:", err);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectUser = (username: string) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    // Replace the partial mention with the full username
    const newTextBefore = textBeforeCursor.replace(/@(\w*)$/, `@${username} `);
    const newValue = newTextBefore + textAfterCursor;

    onChange(newValue);
    setShowSuggestions(false);

    // Refocus input
    if (inputRef.current) {
      inputRef.current.focus();
      // Set cursor position after the inserted mention
      // setTimeout to ensure render updates first
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length);
        }
      }, 0);
    }
  };

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`relative flex items-center w-full ${className || ""}`}>
      {/* Suggestions Popup */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 mb-2 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#1C1C1E] shadow-xl ring-1 ring-black/5 z-50"
        >
          <div className="py-1">
            {suggestions.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.username)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-white/10 transition-colors"
              >
                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-neutral-700">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.username} className="h-full w-full object-cover object-center" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-600 text-xs font-bold text-white">
                      {user.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user.username}</p>
                  <p className="text-xs text-neutral-400 truncate">{user.displayName}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !showSuggestions) {
            onSend();
          } else if (e.key === "Escape") {
            setShowSuggestions(false);
          }
        }}
        placeholder={placeholder || "Add a comment... Use @username to mention."}
        className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-4 pr-10 text-sm text-white placeholder-neutral-500 focus:border-white/20 focus:outline-none focus:ring-0"
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || sending}
        className="absolute right-1.5 rounded-full p-1.5 text-blue-400 hover:bg-white/10 disabled:opacity-50"
      >
        <PaperAirplaneIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
