import { useState, useMemo, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  CssBaseline,
  ThemeProvider,
  Snackbar,
  Link,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Badge,
} from '@mui/material';
import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Check as ValidateIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Terminal as TerminalIcon,
  PhotoCameraBack as PhotoCameraIcon,
  Info,
  Settings as SettingsIcon,
  Hub as AutoLinkIcon,
  PlayArrow as DeployIcon,
} from '@mui/icons-material';
import { toSvg } from 'html-to-image';

import EdaIcon from '../icons/EdaIcon';
import { useTopologyStore } from '../lib/store';
import { detectExtension } from '../lib/extensionAPIClient';
import { exportToYaml, normalizeNodeCoordinates, downloadYaml } from '../lib/yaml-converter';
import { validateNetworkTopology } from '../lib/validate';
import type { ValidationResult } from '../types/ui';
import type { Operation } from '../types/schema';
import { TITLE, ERROR_DISPLAY_DURATION_MS } from '../lib/constants';

import { getEditorContent } from './YamlEditor';

export interface TopologyThemingProps {
  theme?: Theme;
  themeOptions?: ThemeOptions;
  disableCssBaseline?: boolean;
  styleVariables?: Record<string, string>;
}

interface AppLayoutProps extends TopologyThemingProps {
  children: React.ReactNode;
}

export const defaultTopologyThemeOptions: ThemeOptions = {
  cssVariables: true,
  palette: {
    mode: 'dark',
    primary: { main: '#6098FF' },
    error: { main: '#FF6363' },
    warning: { main: '#FFAC0A' },
    success: { main: '#00A87E' },
    info: { main: '#90B7FF' },
    background: { default: '#1A222E', paper: '#101824' },
    text: { primary: '#ffffff', secondary: '#C9CED6' },
    divider: '#4A5361B2',
    card: { bg: '#101824', border: '#4A5361B2' },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"NokiaPureText", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        outlined: {
          backgroundColor: 'var(--mui-palette-card-bg)',
          borderColor: 'var(--mui-palette-card-border)',
        },
      },
    },
  },
};

export function createTopologyTheme(themeOptions?: ThemeOptions): Theme {
  return createTheme(defaultTopologyThemeOptions, themeOptions ?? {});
}

export default function AppLayout({
  children,
  theme: providedTheme,
  themeOptions,
  disableCssBaseline = false,
  styleVariables,
}: AppLayoutProps) {
  const theme = useMemo(() => providedTheme ?? createTopologyTheme(themeOptions), [providedTheme, themeOptions]);

  const topologyName = useTopologyStore(state => state.topologyName);
  const namespace = useTopologyStore(state => state.namespace);
  const operation = useTopologyStore(state => state.operation);
  const nodes = useTopologyStore(state => state.nodes);
  const edges = useTopologyStore(state => state.edges);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const linkTemplates = useTopologyStore(state => state.linkTemplates);
  const simulation = useTopologyStore(state => state.simulation);
  const annotations = useTopologyStore(state => state.annotations);
  const setTopologyName = useTopologyStore(state => state.setTopologyName);
  const setNamespace = useTopologyStore(state => state.setNamespace);
  const setOperation = useTopologyStore(state => state.setOperation);
  const error = useTopologyStore(state => state.error);
  const setError = useTopologyStore(state => state.setError);
  const autoLink = useTopologyStore(state => state.autoLink);

  const [copied, setCopied] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [displayedError, setDisplayedError] = useState<string | null>(null);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localName, setLocalName] = useState(topologyName);
  const [localNamespace, setLocalNamespace] = useState(namespace);
  const [localOperation, setLocalOperation] = useState(operation);

  const isStandalone = typeof __APP_MODE__ === 'undefined' || __APP_MODE__ === 'standalone';

  const edaStatus = useTopologyStore(state => state.edaStatus);
  const edaUrl = useTopologyStore(state => state.edaUrl);
  const edaInit = useTopologyStore(state => state.edaInit);
  const edaDeploying = useTopologyStore(state => state.edaDeploying);
  const deployToEda = useTopologyStore(state => state.deployToEda);

  const [edaDialogOpen, setEdaDialogOpen] = useState(false);

  const commitSha = typeof __COMMIT_SHA__ === 'string' ? __COMMIT_SHA__ : 'unknown';
  const toolbarTextColor = 'text.primary';

  useEffect(() => {
    if (error) {
      setDisplayedError(error);
    }
  }, [error]);

  useEffect(() => {
    if (isStandalone) void edaInit();
  }, [isStandalone]); // eslint-disable-line react-hooks/exhaustive-deps

  const getExportYaml = () => exportToYaml({
    topologyName: `${topologyName}-${Date.now()}`,
    namespace, operation, nodes: normalizeNodeCoordinates(nodes), edges, nodeTemplates, linkTemplates, simulation, annotations,
  });

  const handleDownload = () => {
    const yaml = getExportYaml();
    downloadYaml(yaml, `${topologyName}-${Date.now()}.yaml`);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getExportYaml());
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const handleCopyKubectl = async () => {
    await navigator.clipboard.writeText(`kubectl apply -f - <<'EOF'\n${getExportYaml()}\nEOF`);
    setCopied(true);
    setTimeout(() => { setCopied(false); }, 2000);
  };

  const handleDeploy = async () => {
    // Open a blank window synchronously to avoid popup blockers, then navigate it after deploy succeeds
    const deployWindow = window.open('', '_blank');
    // Ping extension to wake up service worker and wait for session restore
    await detectExtension();
    const result = await deployToEda();
    if (result.ok && result.workflowName) {
      const url = `${edaUrl}/ui/main/workflows/eda/topologies.eda.nokia.com/v1alpha1/networktopologies/${result.workflowName}`;
      if (deployWindow) {
        deployWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }
    } else {
      if (deployWindow) {
        deployWindow.close();
      }
      setError(result.error ?? 'Deploy failed');
    }
  };

  const handleValidate = () => {
    const yaml = getEditorContent()
      || exportToYaml({ topologyName, namespace, operation, nodes, edges, nodeTemplates, linkTemplates, simulation, annotations });
    setValidationResult(validateNetworkTopology(yaml));
    setValidationDialogOpen(true);
  };

  const handleExportSvg = async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) {
      setError('Could not find canvas');
      return;
    }

    if (nodes.length === 0) {
      setError('No nodes to export');
      return;
    }

    const padding = 100;
    const nodeW = 80;
    const nodeH = 80;
    const rects = nodes.map(n => ({
      x: n.position?.x ?? 0,
      y: n.position?.y ?? 0,
      w: nodeW,
      h: nodeH,
    }));
    for (const ann of annotations) {
      const x = ann.position.x;
      const y = ann.position.y;
      const w = ann.type === 'shape' ? ann.width : 200;
      const h = ann.type === 'shape' ? ann.height : ann.fontSize * 2;
      rects.push({ x, y, w, h });
    }
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const imageWidth = Math.max(boundsW + padding * 2, 400);
    const imageHeight = Math.max(boundsH + padding * 2, 400);

    try {
      const dataUrl = await toSvg(viewport, {
        width: imageWidth,
        height: imageHeight,
        fontEmbedCSS: [
          "@font-face { font-family: 'NokiaPureText'; src: url('https://cdn.jsdelivr.net/gh/hellt/fonts@v0.1.0/nokia/NokiaPureText_Lt.woff2') format('woff2'); font-weight: normal; font-style: normal; }",
          "@font-face { font-family: 'NokiaPureText'; src: url('https://cdn.jsdelivr.net/gh/hellt/fonts@v0.1.0/nokia/NokiaPureText_Bd.woff2') format('woff2'); font-weight: bold; font-style: normal; }",
        ].join('\n'),
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${-minX + padding}px, ${-minY + padding}px) scale(1)`,
        },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${topologyName}-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('SVG export failed:', err);
      setError('Failed to export SVG');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      {!disableCssBaseline && <CssBaseline />}
      <Box
        sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}
        style={styleVariables}
      >
        <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
              <img src="/eda.svg" alt="EDA" style={{ height: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 200, color: toolbarTextColor }}>
                {TITLE}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isStandalone && edaStatus === 'connected' && (
                <>
                  <Tooltip title="Deploy to EDA">
                    <span>
                      <IconButton size="small" onClick={() => { void handleDeploy(); }} disabled={edaDeploying} sx={{ color: toolbarTextColor }}>
                        <DeployIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: 'divider', my: 0.5 }} />
                </>
              )}
              <Tooltip title="Validate against schema">
                <IconButton size="small" onClick={handleValidate} sx={{ color: toolbarTextColor }}>
                  <ValidateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'divider', my: 0.5 }} />
              <Tooltip title="AutoLink">
                <IconButton size="small" onClick={autoLink} sx={{ color: toolbarTextColor }}>
                  <AutoLinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'divider', my: 0.5 }} />
              <Tooltip title={copied ? 'Copied!' : 'Copy YAML'}>
                <IconButton size="small" onClick={() => { void handleCopy(); }} sx={{ color: toolbarTextColor }}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy as kubectl apply">
                <IconButton size="small" onClick={() => { void handleCopyKubectl(); }} sx={{ color: toolbarTextColor }}>
                  <TerminalIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download YAML">
                <IconButton size="small" onClick={handleDownload} sx={{ color: toolbarTextColor }}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export SVG">
                <IconButton size="small" onClick={() => { void handleExportSvg(); }} sx={{ color: toolbarTextColor }}>
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {isStandalone && (
                <>
                  <Divider orientation="vertical" flexItem sx={{ borderColor: 'divider', my: 0.5 }} />
                  <Tooltip title={edaStatus === 'connected' ? 'EDA Connected' : 'EDA Connection'}>
                    <IconButton size="small" onClick={() => { setEdaDialogOpen(true); }} sx={{ color: toolbarTextColor }}>
                      <Badge
                        variant="dot"
                        invisible={edaStatus !== 'connected'}
                        sx={{ '& .MuiBadge-badge': { bgcolor: 'success.main' } }}
                      >
                        <EdaIcon fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                </>
              )}
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'divider', my: 0.5 }} />
              <Tooltip title="Settings">
                <IconButton size="small" onClick={() => { setLocalName(topologyName); setLocalNamespace(namespace); setLocalOperation(operation); setSettingsOpen(true); }} sx={{ color: toolbarTextColor }}>
                  <SettingsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="About">
                <IconButton size="small" onClick={() => { setAboutDialogOpen(true); }} sx={{ color: toolbarTextColor }}>
                  <Info fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {children}

        <Dialog open={validationDialogOpen} onClose={() => { setValidationDialogOpen(false); }} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {validationResult?.valid ? <SuccessIcon color="success" /> : <ErrorIcon color="error" />}
            {validationResult?.valid ? 'Validation Passed' : 'Validation Failed'}
          </DialogTitle>
          <DialogContent>
            {validationResult?.valid ? (
              <Alert severity="success">The topology is valid according to the NetworkTopology schema.</Alert>
            ) : (
              <>
                <Alert severity="error" sx={{ mb: 2 }}>Found {validationResult?.errors.length} validation error(s)</Alert>
                <List dense>
                  {validationResult?.errors.map((err, i) => (
                    <ListItem key={i} sx={{ py: 0.5 }}>
                      <ListItemText
                        primary={err.message}
                        secondary={err.path || 'root'}
                        slotProps={{
                          primary: { variant: 'body2' },
                          secondary: { variant: 'caption', sx: { fontFamily: 'monospace' } },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setValidationDialogOpen(false); }}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={settingsOpen} onClose={() => { setSettingsOpen(false); }} maxWidth="xs" fullWidth>
          <DialogTitle>Settings</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Topology Name"
              size="small"
              value={localName}
              onChange={e => { setLocalName(e.target.value); }}
              fullWidth
              sx={{ mt: 1 }}
            />
            <TextField
              label="Namespace"
              size="small"
              value={localNamespace}
              onChange={e => { setLocalNamespace(e.target.value); }}
              fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Operation</InputLabel>
              <Select
                label="Operation"
                value={localOperation}
                onChange={e => { setLocalOperation(e.target.value as Operation); }}
              >
                <MenuItem value="create">create</MenuItem>
                <MenuItem value="replace">replace</MenuItem>
                <MenuItem value="replaceAll">replaceAll</MenuItem>
                <MenuItem value="delete">delete</MenuItem>
                <MenuItem value="deleteAll">deleteAll</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={() => {
              setTopologyName(localName);
              setNamespace(localNamespace);
              setOperation(localOperation);
              setSettingsOpen(false);
            }}>Save</Button>
            <Button onClick={() => { setSettingsOpen(false); }}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={aboutDialogOpen} onClose={() => { setAboutDialogOpen(false); }} maxWidth="xs" fullWidth>
          <DialogTitle>{TITLE} <Typography component="span" variant="caption" color="textSecondary" sx={{ fontFamily: 'monospace' }}>({commitSha})</Typography></DialogTitle>
          <DialogContent sx={{ pb: 0 }}>
            <Container sx={{ textAlign: 'center' }}>
              <Typography variant="body1">
                Topology Builder UI for the <Link href="https://eda.dev" target="_blank" rel="noopener">Nokia EDA</Link> platform allows users to create the input YAML for the topology workflow in a graphical way.
              </Typography>
              <br/>
              <Typography variant="caption">
                Created by <Link target="_blank" href="https://www.linkedin.com/in/kaelem-chandra/">Kaelem Chandra</Link> and <Link target="_blank" href="https://www.linkedin.com/in/rdodin/">Roman Dodin</Link>
              </Typography>
              <br/>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, my: 1 }}>
                <IconButton href="https://github.com/eda-labs/topo-builder" target="_blank" size="small">
                  <svg width="20" height="20" fill={theme.palette.text.primary} viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.026 2c-5.509 0-9.974 4.465-9.974 9.974 0 4.406 2.857 8.145 6.821 9.465.499.09.679-.217.679-.481 0-.237-.008-.865-.011-1.696-2.775.602-3.361-1.338-3.361-1.338-.452-1.152-1.107-1.459-1.107-1.459-.905-.619.069-.605.069-.605 1.002.07 1.527 1.028 1.527 1.028.89 1.524 2.336 1.084 2.902.829.091-.645.351-1.085.635-1.334-2.214-.251-4.542-1.107-4.542-4.93 0-1.087.389-1.979 1.024-2.675-.101-.253-.446-1.268.099-2.64 0 0 .837-.269 2.742 1.021a9.582 9.582 0 0 1 2.496-.336 9.554 9.554 0 0 1 2.496.336c1.906-1.291 2.742-1.021 2.742-1.021.545 1.372.203 2.387.099 2.64.64.696 1.024 1.587 1.024 2.675 0 3.833-2.33 4.675-4.552 4.922.355.308.675.916.675 1.846 0 1.334-.012 2.41-.012 2.737 0 .267.178.577.687.479C19.146 20.115 22 16.379 22 11.974 22 6.465 17.535 2 12.026 2z"></path>
                  </svg>
                </IconButton>
                <IconButton href="https://eda.dev/discord" target="_blank" size="small">
                  <svg width="20" height="20" fill={theme.palette.text.primary} viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.942 5.556a16.3 16.3 0 0 0-4.126-1.3 12.04 12.04 0 0 0-.529 1.1 15.175 15.175 0 0 0-4.573 0 11.586 11.586 0 0 0-.535-1.1 16.274 16.274 0 0 0-4.129 1.3 17.392 17.392 0 0 0-2.868 11.662 15.785 15.785 0 0 0 4.963 2.521c.41-.564.773-1.16 1.084-1.785a10.638 10.638 0 0 1-1.706-.83c.143-.106.283-.217.418-.331a11.664 11.664 0 0 0 10.118 0c.137.114.277.225.418.331-.544.328-1.116.606-1.71.832a12.58 12.58 0 0 0 1.084 1.785 16.46 16.46 0 0 0 5.064-2.595 17.286 17.286 0 0 0-2.973-11.59ZM8.678 14.813a1.94 1.94 0 0 1-1.8-2.045 1.93 1.93 0 0 1 1.8-2.047 1.918 1.918 0 0 1 1.8 2.047 1.929 1.929 0 0 1-1.8 2.045Zm6.644 0a1.94 1.94 0 0 1-1.8-2.045 1.93 1.93 0 0 1 1.8-2.047 1.919 1.919 0 0 1 1.8 2.047 1.93 1.93 0 0 1-1.8 2.045Z"></path>
                  </svg>
                </IconButton>
              </Box>
              <Typography variant="caption" color="textSecondary">
                This is not an official Nokia product.
              </Typography>
            </Container>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setAboutDialogOpen(false); }}>Close</Button>
          </DialogActions>
        </Dialog>

        {isStandalone && (
          <Dialog open={edaDialogOpen} onClose={() => { setEdaDialogOpen(false); }} maxWidth="xs" fullWidth>
            <DialogTitle>EDA Connection</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {edaStatus === 'connected' ? (
                <Alert severity="success" sx={{ mt: 1 }}>Connected to EDA{edaUrl ? ` — ${edaUrl}` : ''}</Alert>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>Not connected to EDA</Alert>
              )}
              <Typography variant="body2" color="text.secondary">
                Use the <Link href="https://github.com/eda-labs/browser-extension" target="_blank" rel="noopener">EDA Browser Extension</Link> to connect.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setEdaDialogOpen(false); }}>Close</Button>
            </DialogActions>
          </Dialog>
        )}

        <Snackbar
          open={!!error}
          autoHideDuration={ERROR_DISPLAY_DURATION_MS}
          onClose={(_, reason) => { if (reason !== 'clickaway') setError(null); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => { setError(null); }} severity="error" variant="filled">{displayedError}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
