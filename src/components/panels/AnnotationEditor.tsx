import { useState, useEffect } from 'react';
import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormControlLabel,
  Checkbox,
  InputLabel,
  Box,
  IconButton,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

import { useTopologyStore } from '../../lib/store';
import { COLOR_PALETTE } from '../../lib/constants';
import type { UIAnnotation, UITextAnnotation, UIShapeAnnotation, AnnotationShapeType, AnnotationStrokeStyle } from '../../types/ui';

import { ColorField, PanelHeader, PanelSection } from './shared';

function TextAnnotationFields({ annotation }: { annotation: UITextAnnotation }) {
  const updateAnnotation = useTopologyStore(s => s.updateAnnotation);
  const [localText, setLocalText] = useState(annotation.text);

  useEffect(() => { setLocalText(annotation.text); }, [annotation.text, annotation.id]);

  return (
    <>
      <TextField
        label="Text"
        value={localText}
        onChange={e => { setLocalText(e.target.value); }}
        onBlur={() => {
          if (localText !== annotation.text) {
            updateAnnotation(annotation.id, { text: localText });
          }
        }}
        multiline
        minRows={2}
        size="small"
        fullWidth
      />

      <TextField
        label="Font Size"
        type="number"
        value={annotation.fontSize}
        onChange={e => { updateAnnotation(annotation.id, { fontSize: parseInt(e.target.value) || annotation.fontSize }); }}
        slotProps={{ htmlInput: { min: 1 } }}
        size="small"
        fullWidth
      />

      <PanelSection title="Color">
        <ColorField
          value={annotation.fontColor}
          onChange={color => { updateAnnotation(annotation.id, { fontColor: color }); }}
          columns={9}
        />
      </PanelSection>
    </>
  );
}

function ShapeAnnotationFields({ annotation }: { annotation: UIShapeAnnotation }) {
  const updateAnnotation = useTopologyStore(s => s.updateAnnotation);

  return (
    <>
      <FormControl size="small" fullWidth>
        <InputLabel>Shape</InputLabel>
        <Select
          value={annotation.shapeType}
          label="Shape"
          onChange={e => { updateAnnotation(annotation.id, { shapeType: e.target.value as AnnotationShapeType }); }}
        >
          <MenuItem value="rectangle">Rectangle</MenuItem>
          <MenuItem value="circle">Circle</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          label="Width"
          type="number"
          value={annotation.width}
          onChange={e => { updateAnnotation(annotation.id, { width: Math.max(60, parseInt(e.target.value) || 60) }); }}
          size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          label="Height"
          type="number"
          value={annotation.height}
          onChange={e => { updateAnnotation(annotation.id, { height: Math.max(40, parseInt(e.target.value) || 40) }); }}
          size="small"
          sx={{ flex: 1 }}
        />
      </Box>

      <PanelSection title="Color">
        <ColorField
          value={annotation.strokeColor}
          onChange={color => {
            const pair = COLOR_PALETTE.find(p => p.stroke.toLowerCase() === color.toLowerCase());
            const fillColor = annotation.fillColor === 'none' ? 'none' : (pair?.fill ?? annotation.fillColor);
            updateAnnotation(annotation.id, { strokeColor: color, fillColor });
          }}
          columns={9}
        />

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={annotation.fillColor !== 'none'}
              onChange={(_e, checked) => {
                if (checked) {
                  const pair = COLOR_PALETTE.find(p => p.stroke.toLowerCase() === annotation.strokeColor.toLowerCase());
                  updateAnnotation(annotation.id, { fillColor: pair?.fill ?? '#30353E' });
                } else {
                  updateAnnotation(annotation.id, { fillColor: 'none' });
                }
              }}
            />
          }
          label="Fill"
          sx={{ mt: 1 }}
        />
      </PanelSection>

      <PanelSection title="Stroke">
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            label="Width"
            type="number"
            value={annotation.strokeWidth}
            onChange={e => { updateAnnotation(annotation.id, { strokeWidth: Math.max(1, parseInt(e.target.value) || 1) }); }}
            size="small"
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { min: 0, max: 20 } }}
          />
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel>Style</InputLabel>
            <Select
              value={annotation.strokeStyle}
              label="Style"
              onChange={e => { updateAnnotation(annotation.id, { strokeStyle: e.target.value as AnnotationStrokeStyle }); }}
            >
              <MenuItem value="solid">Solid</MenuItem>
              <MenuItem value="dashed">Dashed</MenuItem>
              <MenuItem value="dotted">Dotted</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </PanelSection>
    </>
  );
}

export function AnnotationEditor({ annotation }: { annotation: UIAnnotation }) {
  const deleteAnnotation = useTopologyStore(s => s.deleteAnnotation);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PanelHeader
        title={annotation.type === 'text' ? 'Text Annotation' : 'Shape Annotation'}
        actions={
          <IconButton size="small" color="error" onClick={() => { deleteAnnotation(annotation.id); }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        }
      />

      {annotation.type === 'text' && <TextAnnotationFields annotation={annotation} />}
      {annotation.type === 'shape' && <ShapeAnnotationFields annotation={annotation} />}
    </Box>
  );
}
