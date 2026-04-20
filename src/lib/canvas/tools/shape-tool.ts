import { shapeTool } from '../tool-authoring';
import { constrainLine, constrainSquare } from '../tool-registry';

export const lineTool = shapeTool({
	id: 'line',
	stroke: (ctx, start, end) => {
		const pts = ctx.ops.interpolatePixels(start.x, start.y, end.x, end.y);
		ctx.ops.applyStroke(pts, 'line', ctx.drawColor);
	},
	constrainOnShift: constrainLine
});

export const rectangleTool = shapeTool({
	id: 'rectangle',
	stroke: (ctx, start, end) => {
		const pts = ctx.ops.rectangleOutline(start.x, start.y, end.x, end.y);
		ctx.ops.applyStroke(pts, 'rectangle', ctx.drawColor);
	},
	constrainOnShift: constrainSquare
});

export const ellipseTool = shapeTool({
	id: 'ellipse',
	stroke: (ctx, start, end) => {
		const pts = ctx.ops.ellipseOutline(start.x, start.y, end.x, end.y);
		ctx.ops.applyStroke(pts, 'ellipse', ctx.drawColor);
	},
	constrainOnShift: constrainSquare
});
