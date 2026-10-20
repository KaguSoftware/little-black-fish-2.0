"use client";

import type { ReactNode } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from "@hello-pangea/dnd";

export interface SortableListProps {
  droppableId: string;
  ids: string[];
  label: string;
  instructions: string;
  currentId?: string | null;
  onMove: (from: number, to: number) => void;
  renderItem: (id: string, index: number, handle: DraggableProvidedDragHandleProps | null) => ReactNode;
}

/** Drag-and-drop list (client only; loaded through next/dynamic with ssr:false). */
export default function SortableList({ droppableId, ids, label, instructions, currentId, onMove, renderItem }: SortableListProps) {
  const onDragEnd = (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    onMove(r.source.index, r.destination.index);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd} dragHandleUsageInstructions={instructions}>
      <Droppable droppableId={droppableId}>
        {(drop) => (
          <ul ref={drop.innerRef} {...drop.droppableProps} className="adm-list" aria-label={label}>
            {ids.map((id, i) => (
              <Draggable key={id} draggableId={id} index={i}>
                {(drag, snap) => (
                  <li
                    ref={drag.innerRef}
                    {...drag.draggableProps}
                    className="adm-item"
                    data-dragging={snap.isDragging ? "true" : "false"}
                    data-current={currentId === id ? "true" : "false"}
                  >
                    {renderItem(id, i, drag.dragHandleProps)}
                  </li>
                )}
              </Draggable>
            ))}
            {drop.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  );
}
