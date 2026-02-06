import { useCallback, useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Box } from '@mui/material';

import { useTopologyStore } from '../lib/store';
import { LABEL_EDGE_ID, LABEL_MEMBER_INDEX } from '../lib/constants';
import { exportToYaml } from '../lib/yaml-converter';

let editorInstance: editor.IStandaloneCodeEditor | null = null;

function escapeRegExp(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === '\'' && last === '\'')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function findYamlSection(lines: string[], key: string): { startLine: number; indent: number } | null {
  const re = new RegExp(`^(\\s*)${escapeRegExp(key)}:\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(re);
    if (match) return { startLine: i, indent: match[1].length };
  }
  return null;
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function getYamlListItemRange(lines: string[], startLine: number): { start: number; end: number } {
  const listItemIndent = getIndent(lines[startLine] ?? '');
  let end = startLine;

  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedStart = line.trimStart();
    const indent = line.length - trimmedStart.length;

    if (trimmedStart.length === 0) {
      end = i;
      continue;
    }

    if (indent <= listItemIndent) break;
    end = i;
  }

  return { start: startLine, end };
}

function collectYamlListItemStanzas(lines: string[], sectionStartLine: number, sectionIndent: number) {
  const listItemIndent = sectionIndent + 2;
  const stanzas: Array<{ start: number; end: number }> = [];

  for (let i = sectionStartLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedStart = line.trimStart();
    const indent = line.length - trimmedStart.length;

    if (trimmedStart.length > 0 && indent <= sectionIndent && !trimmedStart.startsWith('-')) break;

    if (trimmedStart.startsWith('- ') && indent === listItemIndent) {
      const range = getYamlListItemRange(lines, i);
      stanzas.push(range);
      i = range.end;
    }
  }

  return stanzas;
}

function linkStanzaMatches(stanzaText: string, sourceNode: string, targetNode: string): boolean {
  if (!stanzaText.includes(`node: ${sourceNode}`)) return false;
  if (stanzaText.includes(`node: ${targetNode}`)) return true;
  return stanzaText.includes(`simNode: ${targetNode}`);
}

function getYamlKeyValue(line: string, key: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const re = new RegExp(`^['"]?${escapeRegExp(key)}['"]?:\\s*(.*)$`);
  const match = trimmed.match(re);
  if (!match) return null;

  return stripSurroundingQuotes(match[1] ?? '');
}

function stanzaHasAnyKeyValue(
  lines: string[],
  range: { start: number; end: number },
  keys: string[],
  expected: string,
): boolean {
  for (let i = range.start; i <= range.end; i++) {
    for (const key of keys) {
      const value = getYamlKeyValue(lines[i] ?? '', key);
      if (value === expected) return true;
    }
  }
  return false;
}

export function getEditorContent(): string {
  return editorInstance?.getValue() || '';
}

export function jumpToNodeInEditor(nodeName: string): void {
  if (!editorInstance) return;

  const content = editorInstance.getValue();
  const lines = content.split('\n');
  let inNodesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*nodes:\s*$/.test(line)) {
      inNodesSection = true;
      continue;
    }
    if (inNodesSection && /^[a-zA-Z]/.test(line) && !line.startsWith(' ')) {
      inNodesSection = false;
    }
    if (inNodesSection && line.includes(`name: ${nodeName}`)) {
      editorInstance.revealLineInCenter(i + 1);
      editorInstance.setPosition({ lineNumber: i + 1, column: line.length + 1 });
      return;
    }
  }
}

export function jumpToSimNodeInEditor(simNodeName: string): void {
  if (!editorInstance) return;

  const content = editorInstance.getValue();
  const lines = content.split('\n');
  let inSimNodesSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*simNodes:\s*$/.test(line)) {
      inSimNodesSection = true;
      continue;
    }
    if (inSimNodesSection && /^[a-zA-Z]/.test(line) && !line.startsWith(' ')) {
      inSimNodesSection = false;
    }
    if (inSimNodesSection && line.includes(`name: ${simNodeName}`)) {
      editorInstance.revealLineInCenter(i + 1);
      editorInstance.setPosition({ lineNumber: i + 1, column: line.length + 1 });
      return;
    }
  }
}

export function jumpToLinkInEditor(sourceNode: string, targetNode: string): void {
  if (!editorInstance) return;

  const content = editorInstance.getValue();
  const lines = content.split('\n');

  const linksSection = findYamlSection(lines, 'links');
  if (!linksSection) return;

  const stanzas = collectYamlListItemStanzas(lines, linksSection.startLine, linksSection.indent);
  for (const stanza of stanzas) {
    const stanzaText = lines.slice(stanza.start, stanza.end + 1).join('\n');
    if (!linkStanzaMatches(stanzaText, sourceNode, targetNode)) continue;

    editorInstance.revealLineInCenter(stanza.start + 1);
    editorInstance.setSelection({
      startLineNumber: stanza.start + 1,
      startColumn: 1,
      endLineNumber: stanza.end + 1,
      endColumn: (lines[stanza.end] ?? '').length + 1,
    });
    return;
  }
}

export function jumpToMemberLinkInEditor(edgeId: string, memberIndex: number): void {
  if (!editorInstance) return;

  const content = editorInstance.getValue();
  const lines = content.split('\n');

  const edgeIdKeys = [LABEL_EDGE_ID, 'pos/edgeId'];
  const memberIndexKeys = [LABEL_MEMBER_INDEX, 'pos/memberIndex'];
  const memberIndexString = String(memberIndex);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed.startsWith('- name:')) continue;

    const stanza = getYamlListItemRange(lines, i);
    const matchesEdgeId = stanzaHasAnyKeyValue(lines, stanza, edgeIdKeys, edgeId);
    if (!matchesEdgeId) {
      i = stanza.end;
      continue;
    }

    const matchesMemberIndex = stanzaHasAnyKeyValue(lines, stanza, memberIndexKeys, memberIndexString);
    if (!matchesMemberIndex) {
      i = stanza.end;
      continue;
    }

    editorInstance.revealLineInCenter(stanza.start + 1);
    editorInstance.setSelection({
      startLineNumber: stanza.start + 1,
      startColumn: 1,
      endLineNumber: stanza.end + 1,
      endColumn: (lines[stanza.end] ?? '').length + 1,
    });
    return;
  }
}

export default function YamlEditor() {
  const {
    topologyName, namespace, operation, nodes, edges,
    nodeTemplates, linkTemplates, simulation,
    importFromYaml, yamlRefreshCounter, darkMode,
  } = useTopologyStore();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);

  const getYamlFromState = () => exportToYaml({
    topologyName, namespace, operation, nodes, edges, nodeTemplates, linkTemplates, simulation,
  });

  useEffect(() => {
    if (yamlRefreshCounter > 0 && editorRef.current) {
      isRefreshingRef.current = true;
      editorRef.current.setValue(getYamlFromState());
      setTimeout(() => { isRefreshingRef.current = false; }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yamlRefreshCounter]);

  const handleEditorMount: OnMount = editor => {
    editorRef.current = editor;
    editorInstance = editor;
  };

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value === undefined || isRefreshingRef.current) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => importFromYaml(value), 500);
  }, [importFromYaml]);

  return (
    <Box data-testid="yaml-editor" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1 }}>
        <Editor
          height="100%"
          language="yaml"
          theme={darkMode ? 'vs-dark' : 'light'}
          defaultValue={getYamlFromState()}
          onMount={handleEditorMount}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            folding: true,
            renderLineHighlight: 'all',
            tabSize: 2,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          }}
        />
      </Box>
    </Box>
  );
}
