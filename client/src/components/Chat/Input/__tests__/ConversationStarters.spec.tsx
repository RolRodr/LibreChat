import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EModelEndpoint } from 'librechat-data-provider';
import ConversationStarters from '../ConversationStarters';

const mockSubmitMessage = jest.fn();

jest.mock('~/Providers', () => ({
  useChatContext: jest.fn(),
  useAgentsMapContext: jest.fn(),
  useAssistantsMapContext: jest.fn(),
}));

jest.mock('~/data-provider', () => ({
  useGetEndpointsQuery: jest.fn(),
  useGetAssistantDocsQuery: jest.fn(),
  useGetStartupConfig: jest.fn(),
}));

jest.mock('~/utils', () => ({
  getIconEndpoint: jest.fn(),
  getEntity: jest.fn(),
}));

jest.mock('~/hooks', () => ({
  useSubmitMessage: jest.fn(),
}));

const mockProviders = jest.requireMock('~/Providers');
const mockDataProvider = jest.requireMock('~/data-provider');
const mockUtils = jest.requireMock('~/utils');
const mockHooks = jest.requireMock('~/hooks');

const makeConversation = (overrides = {}) => ({
  endpoint: EModelEndpoint.openAI,
  iconURL: undefined,
  agent_id: undefined,
  assistant_id: undefined,
  spec: undefined,
  ...overrides,
});

const makeStartupConfig = (starters: string[] = [], specName = 'my-spec') => ({
  modelSpecs: {
    list: [{ name: specName, label: 'My Spec', conversation_starters: starters }],
  },
});

describe('ConversationStarters', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockProviders.useChatContext.mockReturnValue({ conversation: makeConversation() });
    mockProviders.useAgentsMapContext.mockReturnValue({});
    mockProviders.useAssistantsMapContext.mockReturnValue({});
    mockDataProvider.useGetEndpointsQuery.mockReturnValue({ data: {} });
    mockDataProvider.useGetAssistantDocsQuery.mockReturnValue({ data: new Map() });
    mockDataProvider.useGetStartupConfig.mockReturnValue({ data: undefined });
    mockUtils.getIconEndpoint.mockReturnValue(EModelEndpoint.openAI);
    mockUtils.getEntity.mockReturnValue({ entity: undefined, isAgent: false });
    mockHooks.useSubmitMessage.mockReturnValue({ submitMessage: mockSubmitMessage });
  });

  it('renders nothing when no starters are available', () => {
    const { container } = render(<ConversationStarters />);
    expect(container.firstChild).toBeNull();
  });

  describe('agent starters', () => {
    it('renders starters from the agent entity', () => {
      mockUtils.getEntity.mockReturnValue({
        entity: { id: 'agent-1', conversation_starters: ['Tell me a story', 'Help me code'] },
        isAgent: true,
      });

      render(<ConversationStarters />);

      expect(screen.getByText('Tell me a story')).toBeInTheDocument();
      expect(screen.getByText('Help me code')).toBeInTheDocument();
    });

    it('renders nothing when agent has no starters', () => {
      mockUtils.getEntity.mockReturnValue({
        entity: { id: 'agent-1', conversation_starters: [] },
        isAgent: true,
      });

      const { container } = render(<ConversationStarters />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('assistant starters', () => {
    it('renders starters from assistant documents map', () => {
      const docsMap = new Map([
        ['asst-1', { assistant_id: 'asst-1', conversation_starters: ['Summarize this', 'Translate to French'] }],
      ]);
      mockUtils.getEntity.mockReturnValue({
        entity: { id: 'asst-1', conversation_starters: [] },
        isAgent: false,
      });
      mockDataProvider.useGetAssistantDocsQuery.mockReturnValue({ data: docsMap });

      render(<ConversationStarters />);

      expect(screen.getByText('Summarize this')).toBeInTheDocument();
      expect(screen.getByText('Translate to French')).toBeInTheDocument();
    });

    it('prefers entity starters over documents map starters', () => {
      const docsMap = new Map([
        ['asst-1', { assistant_id: 'asst-1', conversation_starters: ['From docs map'] }],
      ]);
      mockUtils.getEntity.mockReturnValue({
        entity: { id: 'asst-1', conversation_starters: ['From entity'] },
        isAgent: false,
      });
      mockDataProvider.useGetAssistantDocsQuery.mockReturnValue({ data: docsMap });

      render(<ConversationStarters />);

      expect(screen.getByText('From entity')).toBeInTheDocument();
      expect(screen.queryByText('From docs map')).not.toBeInTheDocument();
    });
  });

  describe('model spec starters', () => {
    it('renders starters from the active model spec', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'my-spec' }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Write a poem', 'Debug my code', 'Explain quantum computing']),
      });

      render(<ConversationStarters />);

      expect(screen.getByText('Write a poem')).toBeInTheDocument();
      expect(screen.getByText('Debug my code')).toBeInTheDocument();
      expect(screen.getByText('Explain quantum computing')).toBeInTheDocument();
    });

    it('renders nothing when spec name does not match any spec in the list', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'nonexistent-spec' }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Write a poem']),
      });

      const { container } = render(<ConversationStarters />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when conversation has no spec', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: undefined }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Write a poem']),
      });

      const { container } = render(<ConversationStarters />);
      expect(container.firstChild).toBeNull();
    });

    it('prefers agent starters over model spec starters', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'my-spec' }),
      });
      mockUtils.getEntity.mockReturnValue({
        entity: { id: 'agent-1', conversation_starters: ['Agent starter'] },
        isAgent: true,
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Spec starter']),
      });

      render(<ConversationStarters />);

      expect(screen.getByText('Agent starter')).toBeInTheDocument();
      expect(screen.queryByText('Spec starter')).not.toBeInTheDocument();
    });
  });

  describe('card limit', () => {
    it('renders at most 4 cards (MAX_CONVO_STARTERS)', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'my-spec' }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['One', 'Two', 'Three', 'Four', 'Five', 'Six']),
      });

      render(<ConversationStarters />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });
  });

  describe('click interaction', () => {
    it('calls submitMessage with the card text when clicked', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'my-spec' }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Write a poem']),
      });

      render(<ConversationStarters />);

      fireEvent.click(screen.getByText('Write a poem'));
      expect(mockSubmitMessage).toHaveBeenCalledWith({ text: 'Write a poem' });
    });

    it('calls submitMessage with the correct text for each card', () => {
      mockProviders.useChatContext.mockReturnValue({
        conversation: makeConversation({ spec: 'my-spec' }),
      });
      mockDataProvider.useGetStartupConfig.mockReturnValue({
        data: makeStartupConfig(['Card A', 'Card B']),
      });

      render(<ConversationStarters />);

      fireEvent.click(screen.getByText('Card B'));
      expect(mockSubmitMessage).toHaveBeenCalledWith({ text: 'Card B' });
      expect(mockSubmitMessage).toHaveBeenCalledTimes(1);
    });
  });
});
