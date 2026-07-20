'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Search, MoreVertical, Check, CheckCheck, MessageCircle } from 'lucide-react';
import Image from 'next/image';

export default function MessagesTab() {
  const { setActiveChat, setActiveTab } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all, unread, groups

  // Mock messages data
  const mockMessages = [
    {
      id: '1',
      userId: 'user1',
      userName: 'Sarah Johnson',
      userImage: '',
      lastMessage: 'Hey! Nice meeting you at the coffee shop',
      timestamp: '2 min ago',
      unread: true,
      online: true,
    },
    {
      id: '2',
      userId: 'user2',
      userName: 'Mike Chen',
      userImage: '',
      lastMessage: 'Sure, let\'s discuss the project tomorrow',
      timestamp: '1 hour ago',
      unread: false,
      online: true,
    },
    {
      id: '3',
      userId: 'user3',
      userName: 'Emma Wilson',
      userImage: '',
      lastMessage: 'Thanks for the recommendations!',
      timestamp: 'Yesterday',
      unread: false,
      online: false,
    },
  ];

  const filteredMessages = mockMessages.filter(message => {
    const matchesSearch = message.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          message.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || 
                          (activeFilter === 'unread' && message.unread);
    return matchesSearch && matchesFilter;
  });

  const handleOpenChat = (message: any) => {
    setActiveChat(message.userId);
    // In a real app, this would navigate to the chat screen
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #F3F3F3',
        padding: '24px',
        paddingTop: 'max(48px, env(safe-area-inset-top) + 16px)',
        paddingBottom: '16px'
      }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          marginBottom: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Messages</h1>
        
        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '20px',
            height: '20px',
            color: '#919191'
          }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            style={{
              width: '100%',
              paddingLeft: '48px',
              paddingRight: '16px',
              paddingTop: '12px',
              paddingBottom: '12px',
              backgroundColor: '#F3F3F3',
              borderRadius: '9999px',
              border: 'none',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {['all', 'unread', 'groups'].map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease',
                backgroundColor: activeFilter === filter ? '#17BFD9' : '#F3F3F3',
                color: activeFilter === filter ? 'white' : '#919191',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              {filter === 'all' ? 'All Messages' : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Messages List */}
      <div style={{ backgroundColor: 'white' }}>
        {filteredMessages.length > 0 ? (
          filteredMessages.map((message, index) => (
            <button
              key={message.id}
              onClick={() => handleOpenChat(message)}
              style={{
                width: '100%',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: 'white',
                borderBottom: index < filteredMessages.length - 1 ? '1px solid #F3F3F3' : 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F3F3'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
            >
              {/* Profile Image */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  backgroundColor: '#F3F3F3',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: '#919191',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.userName.charAt(0)}
                  </span>
                </div>
                {message.online && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#10B981',
                    borderRadius: '50%',
                    border: '2px solid white'
                  }}></div>
                )}
              </div>

              {/* Message Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <h3 style={{
                    fontWeight: '600',
                    color: message.unread ? '#231E20' : '#919191',
                    fontSize: '16px',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.userName}
                  </h3>
                  <span style={{
                    fontSize: '12px',
                    color: message.unread ? '#17BFD9' : '#919191',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.timestamp}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{
                    fontSize: '14px',
                    color: message.unread ? '#231E20' : '#919191',
                    fontWeight: message.unread ? '500' : '400',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    paddingRight: '8px',
                    flex: 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>
                    {message.lastMessage}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {message.unread && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#17BFD9',
                        borderRadius: '50%'
                      }}></div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{
              width: '96px',
              height: '96px',
              backgroundColor: '#F3F3F3',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Search style={{ width: '48px', height: '48px', color: '#919191' }} />
            </div>
            <h3 style={{
              fontWeight: '600',
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No messages found</h3>
            <p style={{
              color: '#919191',
              fontSize: '14px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              {searchQuery ? 'Try a different search term' : 'Start a conversation by connecting with people at your location'}
            </p>
          </div>
        )}
      </div>

      {/* Empty State (when no messages at all) */}
      {!searchQuery && filteredMessages.length === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '96px',
              height: '96px',
              backgroundColor: '#D0F2F7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <MessageCircle style={{ width: '48px', height: '48px', color: '#17BFD9' }} />
            </div>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '8px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>No Messages Yet</h2>
            <p style={{
              color: '#919191',
              marginBottom: '24px',
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              Connect with people at locations to start chatting
            </p>
            <button
              onClick={() => setActiveTab('map')}
              style={{
                backgroundColor: '#17BFD9',
                color: 'white',
                fontWeight: '600',
                padding: '12px 24px',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              Explore Locations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
