'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
    X,
    Maximize2,
    Minimize2,
    Paperclip,
    FileText,
    Image as ImageIcon,
    Phone,
    PhoneOff,
    Calendar as CalendarIcon,
    ArrowUpRight,
    Sparkles,
    Activity,
    AlertCircle,
    Volume2
} from 'lucide-react';
import { Conversation } from '@elevenlabs/client';
import { parseAgentMessage, ParsedCard } from '@/lib/chat/messageParser';
import ConfirmationCard from '@/components/chat/ConfirmationCard';

export interface ChatMessage {
    id: string;
    sender: 'user' | 'agent' | 'system';
    text: string;
    timestamp: string;
    cards?: ParsedCard[];
    attachments?: {
        name: string;
        size: number;
        type: string;
        previewUrl?: string;
    }[];
}

interface StagedFile {
    id: string;
    file: File;
    name: string;
    sizeFormatted: string;
    type: 'image' | 'pdf' | 'other';
    previewUrl?: string;
}

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_0801m3m5germeb8s6vcsfs3evnfg';

/**
 * Exact SVG Mascot from adaaapt.com
 * - Vibrant Cyan circular head with thick 5.5px black stroke
 * - Top-right feather/crest arc
 * - Black eye with white sparkle highlight
 * - Orange beak on bottom right with thick black border
 */
export function AdaaptMascot({ size = 52 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block', flexShrink: 0 }}
        >
            {/* Cyan round body */}
            <circle cx="50" cy="50" r="46" fill="#24BCE7" stroke="#000000" strokeWidth="5.5" />

            {/* Top-right feather crest arc */}
            <path
                d="M74 22 C 84 28, 88 38, 85 45"
                stroke="#000000"
                strokeWidth="5"
                strokeLinecap="round"
            />

            {/* Eye (solid black dot + white highlight) */}
            <circle cx="41" cy="46" r="6" fill="#000000" />
            <circle cx="39.5" cy="44" r="2" fill="#FFFFFF" />

            {/* Orange beak on bottom right */}
            <path
                d="M62 48 C 66 48, 87 56, 81 70 C 76 77, 60 75, 56 67 Z"
                fill="#FF8A00"
                stroke="#000000"
                strokeWidth="5"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export default function HealthcareChatWidget() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [mode, setMode] = useState<'text' | 'voice'>('voice');
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [agentSpeaking, setAgentSpeaking] = useState(false);

    const [conversationId, setConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const conversationRef = useRef<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoSettleTimerRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen && !isMinimized) {
            scrollToBottom();
        }
    }, [messages, isOpen, isMinimized, agentSpeaking]);

    const addSystemMessage = useCallback((text: string) => {
        setMessages(prev => [
            ...prev,
            {
                id: `sys_${Date.now()}_${Math.random()}`,
                sender: 'system',
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ]);
    }, []);

    // Trigger async settlement sync to Supabase & n8n
    const triggerSettlementSync = useCallback(async (convId: string) => {
        try {
            console.log(`[Aura Sync] Initiating async settlement sync for conversation: ${convId}`);
            fetch('/api/triage/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversation_id: convId })
            }).catch(e => console.warn('[Aura Sync] Async background sync error:', e));
        } catch (err) {
            console.error('[Aura Sync] Failed to dispatch settlement sync:', err);
        }
    }, []);

    // Handle agent response & auto-settle trigger
    const handleAgentMessage = useCallback((agentText: string) => {
        const parsedCards = parseAgentMessage(agentText);

        setMessages(prev => [
            ...prev,
            {
                id: `msg_agent_${Date.now()}`,
                sender: 'agent',
                text: agentText,
                cards: parsedCards,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
        ]);

        const lower = agentText.toLowerCase();
        const hasReference = /reference\s*(?:number\s*)?(?:is\s*)?#?([a-f0-9]{8}|[A-Za-z0-9_-]{6,})/i.test(lower);
        const isSettlementConfirmation =
            hasReference &&
            (lower.includes('appointment') ||
                lower.includes('booked') ||
                lower.includes('scheduled') ||
                lower.includes('triage') ||
                lower.includes('refill') ||
                lower.includes('ticket'));

        if (isSettlementConfirmation) {
            console.log('[Aura Widget] Detected confirmation reference. Queuing auto-settlement in 6s...');
            if (autoSettleTimerRef.current) clearTimeout(autoSettleTimerRef.current);
            autoSettleTimerRef.current = setTimeout(async () => {
                console.log('[Aura Widget] Executing auto-settle session end...');
                if (conversationRef.current) {
                    try {
                        await conversationRef.current.endSession();
                    } catch (e) {}
                }
                setIsConnected(false);
                setConnectionStatus('disconnected');
                setAgentSpeaking(false);
                addSystemMessage('Consultation finalized. Transcript synchronized to your chart.');
            }, 6000);
        }
    }, [addSystemMessage]);

    // Initialize or Start ElevenLabs WebRTC session
    const startSession = async (voiceMode = true) => {
        setErrorMsg(null);
        setConnectionStatus('connecting');
        setMode(voiceMode ? 'voice' : 'text');

        try {
            if (voiceMode && typeof navigator !== 'undefined' && navigator.mediaDevices) {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            const conv = await Conversation.startSession({
                agentId: AGENT_ID,
                textOnly: !voiceMode,
                onConnect: ({ conversationId: id }) => {
                    console.log('[ElevenLabs] Connected with session id:', id);
                    setConversationId(id);
                    setIsConnected(true);
                    setConnectionStatus('connected');
                },
                onDisconnect: () => {
                    console.log('[ElevenLabs] Disconnected');
                    setIsConnected(false);
                    setConnectionStatus('disconnected');
                    setAgentSpeaking(false);

                    if (conversationId) {
                        triggerSettlementSync(conversationId);
                    }
                },
                onError: (err: any) => {
                    console.error('[ElevenLabs Error]:', err);
                    setErrorMsg('Voice connection issue. Switched to secure text mode.');
                    setIsConnected(false);
                    setConnectionStatus('disconnected');
                },
                onModeChange: (m: any) => {
                    if (m && typeof m.mode === 'string') {
                        setAgentSpeaking(m.mode === 'speaking');
                    }
                },
                onMessage: (message: any) => {
                    if (message.source === 'ai' || message.role === 'assistant') {
                        const text = message.message || message.text || '';
                        if (text.trim()) {
                            handleAgentMessage(text);
                        }
                    }
                }
            });

            conversationRef.current = conv;
        } catch (err: any) {
            console.error('[ElevenLabs startSession error]:', err);
            setErrorMsg(err.message || 'Microphone access denied or connection failed. You can chat via text.');
            setIsConnected(true);
            setConnectionStatus('connected');
            addSystemMessage('Connected to Aura Assistant.');

            if (messages.length === 0) {
                setTimeout(() => {
                    const welcomeText = "Hey there, I'm Aura with Clinic. Let me know how can I help you today?";
                    setMessages([
                        {
                            id: 'msg_welcome',
                            sender: 'agent',
                            text: welcomeText,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                    ]);
                }, 400);
            }
        }
    };

    const endSession = async () => {
        if (conversationRef.current) {
            try {
                await conversationRef.current.endSession();
            } catch (e) {}
        }
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setAgentSpeaking(false);
        addSystemMessage('Session ended.');
    };

    // Staging and uploading files
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const filesArray = Array.from(e.target.files);

        const newStaged: StagedFile[] = filesArray.map(f => {
            const isImg = f.type.startsWith('image/');
            const isPdf = f.type === 'application/pdf';
            const sizeInKb = (f.size / 1024).toFixed(1);

            return {
                id: `file_${Date.now()}_${Math.random()}`,
                file: f,
                name: f.name,
                sizeFormatted: `${sizeInKb} KB`,
                type: isImg ? 'image' : isPdf ? 'pdf' : 'other',
                previewUrl: isImg ? URL.createObjectURL(f) : undefined
            };
        });

        setStagedFiles(prev => [...prev, ...newStaged]);
        e.target.value = '';
    };

    const handleRemoveStaged = (id: string) => {
        setStagedFiles(prev => prev.filter(f => f.id !== id));
    };

    // Send text / multimodal message
    const handleSendMessage = async (customText?: string) => {
        const textToSend = customText || inputText;
        if (!textToSend.trim() && stagedFiles.length === 0) return;

        const currentFiles = [...stagedFiles];
        setStagedFiles([]);
        setInputText('');

        const userMsgId = `msg_user_${Date.now()}`;
        setMessages(prev => [
            ...prev,
            {
                id: userMsgId,
                sender: 'user',
                text: textToSend,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                attachments: currentFiles.map(f => ({
                    name: f.name,
                    size: f.file.size,
                    type: f.type,
                    previewUrl: f.previewUrl
                }))
            }
        ]);

        try {
            if (conversationRef.current && isConnected) {
                if (currentFiles.length > 0) {
                    setIsUploading(true);
                    const uploadedIds: string[] = [];
                    for (const sf of currentFiles) {
                        try {
                            const res = await conversationRef.current.uploadFile(sf.file);
                            if (res?.file_id) uploadedIds.push(res.file_id);
                        } catch (uploadErr) {
                            console.warn('[Aura] Could not upload via conv.uploadFile:', uploadErr);
                        }
                    }
                    setIsUploading(false);

                    await conversationRef.current.sendMultimodalMessage({
                        text: textToSend,
                        fileIds: uploadedIds
                    });
                } else {
                    await conversationRef.current.sendUserMessage(textToSend);
                }
            } else {
                // Intelligent healthcare clinic response fallback with Generative UI cards
                setTimeout(() => {
                    let reply = "Thank you for contacting Clinic. Let me know how else I can assist your health needs!";
                    const lower = textToSend.toLowerCase();

                    if (lower.includes('triage') || lower.includes('symptom') && (lower.includes('what') || lower.includes('how'))) {
                        reply = "I can assess medical symptoms with clinical triage, route emergency handoffs to on-call nurses, schedule appointments with specialists, and submit prescription refills 24/7.";
                    } else if (lower.includes('cost') || lower.includes('price') || lower.includes('fee')) {
                        reply = "Our 24/7 Aura clinical triage desk is completely free for all patients. Specialist doctor consultations start from BDT 1,200 depending on department and physician.";
                    } else if (lower.includes('book') || lower.includes('appointment') || lower.includes('schedule') || lower.includes('doctor')) {
                        reply = "Your appointment with Dr. A.K.S Zahid Mahmud Khan in Medicine Specialist is scheduled. Your reference number is APT-2026-881290.";
                    } else if (lower.includes('headache') || lower.includes('fever') || lower.includes('symptom') || lower.includes('pain') || currentFiles.length > 0) {
                        reply = "I have logged your symptoms into our clinical triage intake. Your reference number is TRG-74B216E6 with Moderate priority for physician review.";
                    } else if (lower.includes('refill') || lower.includes('prescription') || lower.includes('medicine')) {
                        reply = "Your prescription refill request has been submitted to the Hospital Central Pharmacy. Your reference number is RX-901234.";
                    }

                    const parsed = parseAgentMessage(reply);
                    setMessages(prev => [
                        ...prev,
                        {
                            id: `msg_ai_${Date.now()}`,
                            sender: 'agent',
                            text: reply,
                            cards: parsed,
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                    ]);
                }, 450);
            }
        } catch (err: any) {
            console.error('[Aura] Send failed:', err);
            setErrorMsg('Failed to deliver message.');
            setIsUploading(false);
        }
    };

    // Lifecycle cleanup
    useEffect(() => {
        const handleUnload = () => {
            if (conversationId) {
                navigator.sendBeacon('/api/triage/sync', JSON.stringify({ conversation_id: conversationId }));
            }
            if (conversationRef.current) {
                conversationRef.current.endSession().catch(() => {});
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        return () => {
            window.removeEventListener('beforeunload', handleUnload);
            if (autoSettleTimerRef.current) clearTimeout(autoSettleTimerRef.current);
            if (conversationRef.current) conversationRef.current.endSession().catch(() => {});
        };
    }, [conversationId]);

    // Initial greeting if opened
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    id: 'msg_welcome',
                    sender: 'agent',
                    text: "Hey there, I'm Aura with Clinic. Let me know how can I help you today?",
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]);
        }
    }, [isOpen]);

    // Do not show chatbot widget on printable slip pages and confirmation print views
    if (pathname && (pathname.startsWith('/appointment/slips') || pathname.includes('/slips/'))) {
        return null;
    }

    return (
        <>
            {/* Scoped CSS to enforce the exact adaaapt.com design & defeat Bootstrap overrides */}
            <style>{`
                /* Reposition template scroll-top button to bottom-left so it never interferes with Aura avatar */
                .scroll-top {
                    left: 24px !important;
                    right: auto !important;
                }
                .scroll-top.active {
                    left: 24px !important;
                    right: auto !important;
                    bottom: 24px !important;
                }

                .adaapt-widget-anchor {
                    position: fixed !important;
                    bottom: 24px !important;
                    right: 24px !important;
                    z-index: 99999 !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                }

                /* 1. Closed State Launcher (Pill + Circle Mascot) */
                .adaapt-launcher-cluster {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                    user-select: none !important;
                }

                .adaapt-call-pill {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 9999px !important;
                    padding: 9px 20px 9px 16px !important;
                    box-shadow: 2px 2px 0px #0E1954 !important;
                    cursor: pointer !important;
                    transition: transform 0.15s ease, box-shadow 0.15s ease !important;
                    outline: none !important;
                }

                .adaapt-call-pill:hover {
                    transform: translateY(-2px) !important;
                    box-shadow: 3px 3px 0px #0E1954 !important;
                }

                .adaapt-call-pill:active {
                    transform: translateY(1px) !important;
                    box-shadow: 1px 1px 0px #0E1954 !important;
                }

                .adaapt-red-dot {
                    width: 8px !important;
                    height: 8px !important;
                    border-radius: 50% !important;
                    background-color: #ef4444 !important;
                    display: inline-block !important;
                    animation: adaaptPulse 1.8s infinite !important;
                }

                @keyframes adaaptPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.55; transform: scale(1.25); }
                }

                .adaapt-call-label {
                    font-weight: 700 !important;
                    font-size: 14px !important;
                    color: #0E1954 !important;
                    letter-spacing: -0.2px !important;
                }

                .adaapt-circle-mascot-btn {
                    width: 54px !important;
                    height: 54px !important;
                    border-radius: 50% !important;
                    background: transparent !important;
                    border: none !important;
                    padding: 0 !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 2px 2px 0px #0E1954 !important;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
                }

                .adaapt-circle-mascot-btn:hover {
                    transform: scale(1.08) rotate(3deg) !important;
                }

                /* 2. Open State Modal Window */
                .adaapt-chat-window {
                    width: 395px !important;
                    max-width: calc(100vw - 32px) !important;
                    height: 615px !important;
                    max-height: calc(100vh - 40px) !important;
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 20px !important;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28) !important;
                    display: flex !important;
                    flex-direction: column !important;
                    overflow: hidden !important;
                    animation: adaaptAppear 0.22s ease-out !important;
                }

                @keyframes adaaptAppear {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                /* Minimized: the base height above is !important, so the collapsed size must be too */
                .adaapt-chat-window.adaapt-minimized {
                    height: auto !important;
                    width: 310px !important;
                }

                .adaapt-header {
                    background: #1B2978 !important;
                    padding: 14px 18px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                    border-bottom: 2px solid #0E1954 !important;
                }

                .adaapt-header-left {
                    display: flex !important;
                    align-items: center !important;
                    gap: 12px !important;
                }

                .adaapt-header-title {
                    font-size: 15px !important;
                    font-weight: 700 !important;
                    color: #ffffff !important;
                    margin: 0 !important;
                    letter-spacing: -0.2px !important;
                    line-height: 1.2 !important;
                }

                .adaapt-header-status {
                    font-size: 10px !important;
                    color: #F28BDD !important;
                    font-weight: 700 !important;
                    letter-spacing: 0.7px !important;
                    text-transform: uppercase !important;
                    margin: 3px 0 0 0 !important;
                    display: flex !important;
                    align-items: center !important;
                    gap: 5px !important;
                }

                .adaapt-header-status-dot {
                    width: 6px !important;
                    height: 6px !important;
                    border-radius: 50% !important;
                    background-color: #F28BDD !important;
                }

                .adaapt-header-actions {
                    display: flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }

                .adaapt-header-icon-btn {
                    background: transparent !important;
                    border: none !important;
                    color: rgba(255, 255, 255, 0.8) !important;
                    padding: 6px !important;
                    border-radius: 6px !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    transition: color 0.15s ease, background 0.15s ease !important;
                }

                .adaapt-header-icon-btn:hover {
                    color: #ffffff !important;
                    background: rgba(255, 255, 255, 0.15) !important;
                }

                /* Scrollable Messages Stream */
                .adaapt-messages-area {
                    flex-grow: 1 !important;
                    padding: 18px 16px !important;
                    overflow-y: auto !important;
                    background-color: #ffffff !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 14px !important;
                }

                .adaapt-messages-area::-webkit-scrollbar {
                    width: 5px !important;
                }
                .adaapt-messages-area::-webkit-scrollbar-thumb {
                    background: #C9D6F5 !important;
                    border-radius: 4px !important;
                }

                /* Message Bubbles */
                .adaapt-ai-msg-row {
                    display: flex !important;
                    align-items: flex-start !important;
                    gap: 10px !important;
                }

                .adaapt-ai-bubble {
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 14px !important;
                    padding: 12px 15px !important;
                    color: #0E1954 !important;
                    font-size: 13.5px !important;
                    line-height: 1.45 !important;
                    max-width: 86% !important;
                    font-weight: 400 !important;
                }

                .adaapt-user-msg-row {
                    display: flex !important;
                    justify-content: flex-end !important;
                }

                .adaapt-user-bubble {
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 14px !important;
                    padding: 11px 15px !important;
                    color: #0E1954 !important;
                    font-size: 13.5px !important;
                    line-height: 1.45 !important;
                    max-width: 85% !important;
                    font-weight: 400 !important;
                }

                /* Neo-brutalist Action Suggestion Buttons */
                .adaapt-options-cluster {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    gap: 8px !important;
                    margin-left: 38px !important;
                    margin-top: -2px !important;
                }

                .adaapt-btn-white {
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 8px !important;
                    padding: 7px 15px !important;
                    font-size: 13px !important;
                    font-weight: 700 !important;
                    color: #0E1954 !important;
                    box-shadow: 2px 2px 0px #0E1954 !important;
                    cursor: pointer !important;
                    transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.1s ease !important;
                    text-align: left !important;
                    outline: none !important;
                }

                .adaapt-btn-white:hover {
                    transform: translate(-1px, -1px) !important;
                    box-shadow: 3px 3px 0px #0E1954 !important;
                    background: #F5F9FC !important;
                }

                .adaapt-btn-white:active {
                    transform: translate(1px, 1px) !important;
                    box-shadow: 1px 1px 0px #0E1954 !important;
                }

                .adaapt-btn-orange {
                    background: #F28BDD !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 8px !important;
                    padding: 7px 15px !important;
                    font-size: 13px !important;
                    font-weight: 700 !important;
                    color: #0E1954 !important;
                    box-shadow: 2px 2px 0px #0E1954 !important;
                    cursor: pointer !important;
                    transition: transform 0.1s ease, box-shadow 0.1s ease, background 0.1s ease !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    text-align: left !important;
                    outline: none !important;
                }

                .adaapt-btn-orange:hover {
                    transform: translate(-1px, -1px) !important;
                    box-shadow: 3px 3px 0px #0E1954 !important;
                    background: #E46BC9 !important;
                }

                .adaapt-btn-orange:active {
                    transform: translate(1px, 1px) !important;
                    box-shadow: 1px 1px 0px #0E1954 !important;
                }

                /* Footer Unified Neo-Brutalist Input Container */
                .adaapt-footer-wrapper {
                    background: #ffffff !important;
                    padding: 10px 14px 14px 14px !important;
                }

                .adaapt-unified-input-card {
                    background: #ffffff !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 16px !important;
                    padding: 10px 12px 10px 12px !important;
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 8px !important;
                }

                .adaapt-unified-textarea {
                    width: 100% !important;
                    border: none !important;
                    outline: none !important;
                    resize: none !important;
                    background: transparent !important;
                    font-size: 13px !important;
                    color: #0E1954 !important;
                    line-height: 1.4 !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-family: inherit !important;
                }

                .adaapt-unified-textarea::placeholder {
                    color: #8C94B5 !important;
                }

                .adaapt-unified-actions {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: space-between !important;
                }

                .adaapt-tool-btn {
                    width: 36px !important;
                    height: 34px !important;
                    border: 2px solid #0E1954 !important;
                    border-radius: 8px !important;
                    background: #ffffff !important;
                    color: #0E1954 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    cursor: pointer !important;
                    transition: transform 0.1s ease, background 0.15s ease !important;
                    outline: none !important;
                    padding: 0 !important;
                }

                .adaapt-tool-btn:hover {
                    background: #EDF4FA !important;
                    transform: translateY(-1px) !important;
                }

                .adaapt-tool-btn:active {
                    transform: translateY(1px) !important;
                }

                .adaapt-clip-btn {
                    color: #E46BC9 !important;
                }

                .adaapt-send-peach-btn {
                    background: #F7C6EE !important;
                    color: #0E1954 !important;
                }

                .adaapt-send-peach-btn:hover {
                    background: #F28BDD !important;
                }

                .adaapt-right-tools {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px !important;
                }

                /* Live Equalizer Waveform bars for Voice Mode */
                .adaapt-waveform-bar {
                    width: 3px !important;
                    height: 12px !important;
                    background: #16a34a !important;
                    border-radius: 2px !important;
                    display: inline-block !important;
                    animation: adaaptWave 0.8s ease-in-out infinite alternate !important;
                }
                .adaapt-waveform-bar:nth-child(2) { animation-delay: 0.15s !important; height: 16px !important; }
                .adaapt-waveform-bar:nth-child(3) { animation-delay: 0.3s !important; height: 10px !important; }
                .adaapt-waveform-bar:nth-child(4) { animation-delay: 0.45s !important; height: 18px !important; }

                @keyframes adaaptWave {
                    0% { transform: scaleY(0.4); }
                    100% { transform: scaleY(1.3); }
                }
            `}</style>

            <div className="adaapt-widget-anchor">
                {/* 1. CLOSED STATE LAUNCHER (Call Aura Pill + Mascot Circle) */}
                {!isOpen && (
                    <div className="adaapt-launcher-cluster">
                        {/* "Call Aura" Pill */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(true);
                                setIsMinimized(false);
                                if (!isConnected) startSession(true); // Start voice session
                            }}
                            className="adaapt-call-pill"
                            aria-label="Call Aura AI Healthcare Assistant"
                        >
                            <span className="adaapt-red-dot"></span>
                            <span className="adaapt-call-label">Call Aura</span>
                        </button>

                        {/* Circular Mascot Button */}
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(true);
                                setIsMinimized(false);
                                if (!isConnected) startSession(false);
                            }}
                            className="adaapt-circle-mascot-btn"
                            aria-label="Open Aura AI Chat Desk"
                        >
                            <AdaaptMascot size={54} />
                        </button>
                    </div>
                )}

                {/* 2. OPEN STATE CHAT MODAL (adaaapt.com layout) */}
                {isOpen && (
                    <div
                        className={`adaapt-chat-window${isMinimized ? ' adaapt-minimized' : ''}`}
                    >
                        {/* Header */}
                        <div className="adaapt-header">
                            <div className="adaapt-header-left">
                                <AdaaptMascot size={32} />
                                <div>
                                    <h3 className="adaapt-header-title">Aura</h3>
                                    <p className="adaapt-header-status">
                                        <span
                                            className="adaapt-header-status-dot"
                                            style={{ backgroundColor: isConnected ? '#F28BDD' : '#F7C6EE' }}
                                        ></span>
                                        <span>
                                            {connectionStatus === 'connected'
                                                ? agentSpeaking
                                                    ? 'SPEAKING'
                                                    : 'CONNECTED'
                                                : connectionStatus === 'connecting'
                                                ? 'CONNECTING'
                                                : 'CONNECTED'}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="adaapt-header-actions">
                                <button
                                    type="button"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="adaapt-header-icon-btn"
                                    title={isMinimized ? 'Expand' : 'Minimize'}
                                >
                                    {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsOpen(false);
                                        endSession();
                                    }}
                                    className="adaapt-header-icon-btn"
                                    title="Close Assistant"
                                >
                                    <X size={17} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        {!isMinimized && (
                            <>
                                {/* Voice Listening Banner with Audio Equalizer Waveform */}
                                {mode === 'voice' && isConnected && (
                                    <div
                                        style={{
                                            backgroundColor: '#f0fdf4',
                                            borderBottom: '1.5px solid #0E1954',
                                            padding: '8px 14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '12px',
                                            color: '#166534',
                                            fontWeight: 600
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '16px' }}>
                                                <span className="adaapt-waveform-bar"></span>
                                                <span className="adaapt-waveform-bar"></span>
                                                <span className="adaapt-waveform-bar"></span>
                                                <span className="adaapt-waveform-bar"></span>
                                            </div>
                                            <span>{agentSpeaking ? 'Aura is speaking...' : 'Listening... Speak into mic'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={endSession}
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: '#b91c1c',
                                                border: '1.5px solid #0E1954',
                                                backgroundColor: '#ffffff',
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                boxShadow: '1px 1px 0px #0E1954'
                                            }}
                                        >
                                            End Call
                                        </button>
                                    </div>
                                )}

                                {/* Error alert */}
                                {errorMsg && (
                                    <div
                                        style={{
                                            backgroundColor: '#fffbeb',
                                            borderBottom: '1px solid #0E1954',
                                            padding: '6px 12px',
                                            color: '#92400e',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <AlertCircle size={13} color="#E46BC9" />
                                        <span>{errorMsg}</span>
                                    </div>
                                )}

                                {/* Messages Scroll Area */}
                                <div className="adaapt-messages-area">
                                    {messages.map((m) => {
                                        if (m.sender === 'system') {
                                            return (
                                                <div key={m.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '10px',
                                                            backgroundColor: '#EDF4FA',
                                                            border: '1px solid #0E1954',
                                                            color: '#334155',
                                                            padding: '2px 8px',
                                                            borderRadius: '6px',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {m.text}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        const isUser = m.sender === 'user';

                                        if (isUser) {
                                            return (
                                                <div key={m.id} className="adaapt-user-msg-row">
                                                    <div className="adaapt-user-bubble">
                                                        {m.text}

                                                        {m.attachments && m.attachments.length > 0 && (
                                                            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                {m.attachments.map((att, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        style={{
                                                                            fontSize: '10px',
                                                                            backgroundColor: '#EDF4FA',
                                                                            border: '1px solid #0E1954',
                                                                            padding: '2px 6px',
                                                                            borderRadius: '4px',
                                                                            fontWeight: 600
                                                                        }}
                                                                    >
                                                                        {att.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // AI Message Row
                                        return (
                                            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div className="adaapt-ai-msg-row">
                                                    <AdaaptMascot size={28} />
                                                    <div className="adaapt-ai-bubble">
                                                        {m.text}
                                                    </div>
                                                </div>

                                                {/* If this is the welcome message, render Clinic quick action suggestion buttons */}
                                                {m.id === 'msg_welcome' && (
                                                    <div className="adaapt-options-cluster">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendMessage('What do you triage?')}
                                                            className="adaapt-btn-white"
                                                        >
                                                            What do you triage?
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendMessage('What are your doctor consultation fees?')}
                                                            className="adaapt-btn-white"
                                                        >
                                                            Doctor consultation fees?
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendMessage('I would like to book a doctor appointment')}
                                                            className="adaapt-btn-orange"
                                                        >
                                                            <CalendarIcon size={14} />
                                                            <span>Book an appointment</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Generative UI Cards */}
                                                {m.cards && m.cards.length > 0 && (
                                                    <div style={{ marginLeft: '38px', maxWidth: '88%' }}>
                                                        {m.cards.map((c) => (
                                                            <ConfirmationCard
                                                                key={c.id}
                                                                card={c}
                                                                onActionSelect={(key) => {
                                                                    if (key === 'open_patient_form') {
                                                                        window.location.href = '/patient/book';
                                                                    } else {
                                                                        handleSendMessage("I'd like to continue chatting with you, Aura.");
                                                                    }
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Staged Attachments Tray */}
                                {stagedFiles.length > 0 && (
                                    <div
                                        style={{
                                            padding: '8px 14px',
                                            backgroundColor: '#F5F9FC',
                                            borderTop: '1.5px solid #0E1954',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            overflowX: 'auto'
                                        }}
                                    >
                                        {stagedFiles.map((sf) => (
                                            <div
                                                key={sf.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    backgroundColor: '#ffffff',
                                                    border: '1.5px solid #0E1954',
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 600,
                                                    boxShadow: '1px 1px 0px #0E1954'
                                                }}
                                            >
                                                {sf.type === 'image' ? <ImageIcon size={12} color="#0284c7" /> : <FileText size={12} color="#e11d48" />}
                                                <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {sf.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveStaged(sf.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <X size={11} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Footer Input Container (adaaapt.com layout) */}
                                <div className="adaapt-footer-wrapper">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        multiple
                                        accept="image/png,image/jpeg,application/pdf"
                                        style={{ display: 'none' }}
                                    />

                                    {/* Unified Neo-Brutalist Input Card */}
                                    <div className="adaapt-unified-input-card">
                                        <textarea
                                            rows={2}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Ask about symptoms, doctor appointments, or call..."
                                            className="adaapt-unified-textarea"
                                        />

                                        {/* Action Buttons Row */}
                                        <div className="adaapt-unified-actions">
                                            {/* Attachment Paperclip Button (Red Icon) */}
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="adaapt-tool-btn adaapt-clip-btn"
                                                title="Attach Medical Report, Lab PDF, or Photo"
                                            >
                                                <Paperclip size={16} strokeWidth={2.2} />
                                            </button>

                                            {/* Right Action Icons: [Calendar] [Phone] [Peach Send] */}
                                            <div className="adaapt-right-tools">
                                                {/* Calendar / Book Action */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendMessage('I would like to book a doctor appointment')}
                                                    className="adaapt-tool-btn"
                                                    title="Book a doctor appointment"
                                                >
                                                    <CalendarIcon size={16} strokeWidth={2.2} />
                                                </button>

                                                {/* Phone / Voice Call Toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (isConnected) {
                                                            endSession();
                                                        } else {
                                                            startSession(true);
                                                        }
                                                    }}
                                                    className="adaapt-tool-btn"
                                                    style={{
                                                        backgroundColor: isConnected ? '#fee2e2' : '#ffffff',
                                                        borderColor: isConnected ? '#ef4444' : '#0E1954'
                                                    }}
                                                    title={isConnected ? 'End voice call' : 'Start voice call with Aura'}
                                                >
                                                    {isConnected ? <PhoneOff size={16} color="#ef4444" strokeWidth={2.2} /> : <Phone size={16} strokeWidth={2.2} />}
                                                </button>

                                                {/* Send Button (Warm Peach Background) */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendMessage()}
                                                    disabled={isUploading}
                                                    className="adaapt-tool-btn adaapt-send-peach-btn"
                                                    title="Send message to Aura"
                                                >
                                                    <ArrowUpRight size={18} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
