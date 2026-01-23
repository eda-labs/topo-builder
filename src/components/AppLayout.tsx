import { useState, useMemo, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
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
  createTheme,
  Snackbar,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  PlayArrow as ValidateIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Terminal as TerminalIcon,
  PhotoCamera as PhotoCameraIcon,
} from '@mui/icons-material';
import { toSvg } from 'html-to-image';
import { getNodesBounds } from '@xyflow/react';
import { useTopologyStore } from '../lib/store';
import { exportToYaml, downloadYaml } from '../lib/converter';
import { validateNetworkTopology, type ValidationResult } from '../lib/validate';
import { getEditorContent } from './YamlEditor';
import { TITLE, ERROR_DISPLAY_DURATION_MS } from '../lib/constants';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const darkMode = useTopologyStore((state) => state.darkMode);
  const setDarkMode = useTopologyStore((state) => state.setDarkMode);

  const theme = useMemo(() => createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: '#7d33f2', light: '#9a5ff5', dark: '#5c1fd4' },
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          outlined: {
            backgroundColor: darkMode ? '#262626' : '#f5f5f5',
            borderColor: darkMode ? '#424242' : '#e0e0e0',
          },
        },
      },
    },
  }), [darkMode]);

  const topologyName = useTopologyStore((state) => state.topologyName);
  const namespace = useTopologyStore((state) => state.namespace);
  const operation = useTopologyStore((state) => state.operation);
  const nodes = useTopologyStore((state) => state.nodes);
  const edges = useTopologyStore((state) => state.edges);
  const nodeTemplates = useTopologyStore((state) => state.nodeTemplates);
  const linkTemplates = useTopologyStore((state) => state.linkTemplates);
  const edgeLinks = useTopologyStore((state) => state.edgeLinks);
  const simulation = useTopologyStore((state) => state.simulation);
  const error = useTopologyStore((state) => state.error);
  const setError = useTopologyStore((state) => state.setError);

  const [copied, setCopied] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [displayedError, setDisplayedError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setDisplayedError(error);
    }
  }, [error]);
  
  const getYaml = (withTimestamp = false) => exportToYaml({
    topologyName: withTimestamp ? `${topologyName}-${Date.now()}` : topologyName,
    namespace, operation, nodes, edges, nodeTemplates, linkTemplates, edgeLinks, simulation,
  });

  const handleDownload = () => downloadYaml(getYaml(true), `${topologyName}-${Date.now()}.yaml`);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(getYaml(true));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyKubectl = async () => {
    await navigator.clipboard.writeText(`kubectl apply -f - <<'EOF'\n${getYaml(true)}\nEOF`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleValidate = () => {
    const yamlToValidate = getEditorContent();
    if (!yamlToValidate) {
      setValidationResult({ valid: false, errors: [{ path: '', message: 'Could not read editor content' }] });
      setValidationDialogOpen(true);
      return;
    }
    setValidationResult(validateNetworkTopology(yamlToValidate));
    setValidationDialogOpen(true);
  };

  const handleExportSvg = async () => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!viewport) {
      setError('Could not find canvas');
      return;
    }

    const padding = 100;
    const nodesBounds = getNodesBounds(nodes);
    const imageWidth = Math.max(nodesBounds.width + padding * 2, 400);
    const imageHeight = Math.max(nodesBounds.height + padding * 2, 400);

    try {
      const dataUrl = await toSvg(viewport, {
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${-nodesBounds.x + padding}px, ${-nodesBounds.y + padding}px) scale(1)`,
        },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${topologyName}-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError('Failed to export SVG');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={1} sx={{ bgcolor: 'var(--color-primary)' }}>
          <Toolbar variant="dense">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
              <img src={`${import.meta.env.BASE_URL}/eda.svg`} alt="EDA" style={{ height: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 200, color: 'white' }}>
                {TITLE}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Validate against schema">
                <IconButton size="small" onClick={handleValidate} sx={{ color: 'white' }}>
                  <ValidateIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={copied ? 'Copied!' : 'Copy YAML'}>
                <IconButton size="small" onClick={handleCopy} sx={{ color: 'white' }}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Copy as kubectl apply">
                <IconButton size="small" onClick={handleCopyKubectl} sx={{ color: 'white' }}>
                  <TerminalIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Download YAML">
                <IconButton size="small" onClick={handleDownload} sx={{ color: 'white' }}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Save as SVG">
                <IconButton size="small" onClick={handleExportSvg} sx={{ color: 'white' }}>
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={darkMode ? 'Light mode' : 'Dark mode'}>
                <IconButton size="small" onClick={() => setDarkMode(!darkMode)} sx={{ color: 'white' }}>
                  {darkMode ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
          </Toolbar>
        </AppBar>

        {children}

        <Dialog open={validationDialogOpen} onClose={() => setValidationDialogOpen(false)} maxWidth="sm" fullWidth>
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
            <Button onClick={() => setValidationDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={!!error}
          autoHideDuration={ERROR_DISPLAY_DURATION_MS}
          onClose={(_, reason) => reason !== 'clickaway' && setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setError(null)} severity="error" variant="filled">{displayedError}</Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
