import { Box } from '@mui/material';
import { Speed as SpeedIcon, ViewInAr as ContainerIcon } from '@mui/icons-material';

import { useTopologyStore } from '../../../lib/store';
import spineIcon from '../../../static/icons/spine.svg?raw';
import leafIcon from '../../../static/icons/leaf.svg?raw';
import superspineIcon from '../../../static/icons/superspine.svg?raw';
import type { SimNodeType } from '../../../types/schema';

const RoleIcons: Record<string, string> = {
  spine: spineIcon,
  leaf: leafIcon,
  borderleaf: leafIcon,
  superspine: superspineIcon,
};

const TEXT_PRIMARY = 'text.primary';
const TEXT_SECONDARY = 'text.secondary';
const NODE_LABEL_FONT_SIZE = '0.7rem';
const INTERFACE_LABEL_FONT_SIZE = '0.65rem';

interface LinkDiagramProps {
  localNode: string;
  remoteNode: string;
  localInterface?: string;
  remoteInterface?: string;
  centerLabel?: string;
}

function NodeIcon({ role, simNodeType }: { role?: string; simNodeType?: SimNodeType }) {
  // Role-based SVG icons (for regular nodes)
  if (role) {
    const iconSvg = RoleIcons[role];
    if (iconSvg) {
      return (
        <span
          style={{ width: 28, height: 28, display: 'block', flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: iconSvg }}
        />
      );
    }
  }

  // SimNode type-based MUI icons
  if (simNodeType) {
    const IconComponent = simNodeType === 'TestMan' ? SpeedIcon : ContainerIcon;
    return (
      <Box
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          bgcolor: 'action.hover',
          border: '1px dashed',
          borderColor: TEXT_SECONDARY,
        }}
      >
        <IconComponent sx={{ fontSize: 18, color: TEXT_SECONDARY }} />
      </Box>
    );
  }

  // Default placeholder box
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: '4px',
        bgcolor: 'primary.main',
        opacity: 0.15,
        border: '1px solid',
        borderColor: 'primary.main',
      }}
    />
  );
}

function useNodeIconProps(nodeName: string): { role?: string; simNodeType?: SimNodeType } {
  const nodes = useTopologyStore(state => state.nodes);
  const nodeTemplates = useTopologyStore(state => state.nodeTemplates);
  const simulation = useTopologyStore(state => state.simulation);

  const nodeData = nodes.find(n => n.data.name === nodeName)?.data;
  if (!nodeData) return {};

  // Get role from node data or template
  let role: string | undefined;
  if (nodeData.role) {
    role = nodeData.role;
  } else if (nodeData.labels?.['eda.nokia.com/role']) {
    role = nodeData.labels['eda.nokia.com/role'];
  } else if (nodeData.template) {
    const template = nodeTemplates.find(t => t.name === nodeData.template);
    if (template?.labels?.['eda.nokia.com/role']) {
      role = template.labels['eda.nokia.com/role'];
    }
  }

  // Get SimNode type if applicable
  let simNodeType: SimNodeType | undefined;
  if (nodeData.nodeType === 'simnode') {
    simNodeType = nodeData.simNodeType
      || simulation.simNodeTemplates?.find(t => t.name === nodeData.template)?.type
      || 'Linux';
  }

  return { role, simNodeType };
}

export function LinkDiagram({
  localNode,
  remoteNode,
  localInterface,
  remoteInterface,
  centerLabel,
}: LinkDiagramProps) {
  const localProps = useNodeIconProps(localNode);
  const remoteProps = useNodeIconProps(remoteNode);
  return (
    <Box sx={{ py: '0.25rem' }}>
      {/* Top row: icons and connecting line */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
        }}
      >
        {/* Left icon */}
        <NodeIcon role={localProps.role} simNodeType={localProps.simNodeType} />

        {/* Connecting dotted line */}
        <Box
          sx={{
            flex: 1,
            height: 0,
            borderTop: '1px dashed',
            borderColor: TEXT_SECONDARY,
            opacity: 0.5,
          }}
        />

        {/* Right icon */}
        <NodeIcon role={remoteProps.role} simNodeType={remoteProps.simNodeType} />
      </Box>

      {/* Bottom row: labels */}
      {centerLabel ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mt: '0.25rem',
          }}
        >
          <Box
            sx={{
              fontSize: NODE_LABEL_FONT_SIZE,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              textAlign: 'left',
            }}
          >
            {localNode}
          </Box>
          <Box
            sx={{
              fontSize: INTERFACE_LABEL_FONT_SIZE,
              color: TEXT_SECONDARY,
              textAlign: 'center',
            }}
          >
            {centerLabel}
          </Box>
          <Box
            sx={{
              fontSize: NODE_LABEL_FONT_SIZE,
              fontWeight: 500,
              color: TEXT_PRIMARY,
              textAlign: 'right',
            }}
          >
            {remoteNode}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mt: '0.25rem',
          }}
        >
          {/* Left labels */}
          <Box sx={{ textAlign: 'left' }}>
            <Box
              sx={{
                fontSize: NODE_LABEL_FONT_SIZE,
                fontWeight: 500,
                color: TEXT_PRIMARY,
              }}
            >
              {localNode}
            </Box>
            {localInterface && (
              <Box
                sx={{
                  fontSize: INTERFACE_LABEL_FONT_SIZE,
                  color: TEXT_SECONDARY,
                }}
              >
                {localInterface}
              </Box>
            )}
          </Box>

          {/* Right labels */}
          <Box sx={{ textAlign: 'right' }}>
            <Box
              sx={{
                fontSize: NODE_LABEL_FONT_SIZE,
                fontWeight: 500,
                color: TEXT_PRIMARY,
              }}
            >
              {remoteNode}
            </Box>
            {remoteInterface && (
              <Box
                sx={{
                  fontSize: INTERFACE_LABEL_FONT_SIZE,
                  color: TEXT_SECONDARY,
                }}
              >
                {remoteInterface}
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
