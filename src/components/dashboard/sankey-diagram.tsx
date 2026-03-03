"use client";

import { useMemo } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey'; type SankeyNode = {
    nodeId: string;
    name: string;
};

type SankeyLink = {
    source: string;
    target: string;
    value: number;
};

export type SankeyData = {
    nodes: SankeyNode[];
    links: SankeyLink[];
};

type SankeyDiagramProps = {
    data: SankeyData;
    width: number;
    height: number;
};

const MARGIN_Y = 24;
const MARGIN_X = 24;
const COLORS = [
    "#66C5CC", "#F6CF71", "#F89C74", "#DCB0F2", "#87C55F",
    "#9EB9F3", "#FE88B1", "#C9DB74", "#8BE0A4", "#B497E7",
    "#D3B484", "#B3B3B3"
];


export const SankeyDiagram = ({ data, width, height }: SankeyDiagramProps) => {
    const sankeyLayout = useMemo(() => {
        const sankeyGenerator = d3Sankey<SankeyNode, SankeyLink>()
            .nodeWidth(15)
            .nodePadding(10)
            .extent([
                [MARGIN_X, MARGIN_Y],
                [width - MARGIN_X, height - MARGIN_Y],
            ])
            .nodeId((d) => d.nodeId)
            .nodeAlign(sankeyJustify);

        return sankeyGenerator(data);
    }, [data, width, height]);

    const format = d3.format("$,.2f");

    const allNodes = sankeyLayout.nodes.map((node) => (
        <g key={node.index}>
            <rect
                x={node.x0!}
                y={node.y0!}
                width={node.x1! - node.x0!}
                height={Math.max(1, node.y1! - node.y0!)}
                fill={COLORS[node.index! % COLORS.length]}
                stroke="none"
            />
            <text
                x={node.x0! < width / 2 ? node.x1! + 6 : node.x0! - 6}
                y={(node.y1! + node.y0!) / 2}
                dy="0.35em"
                textAnchor={node.x0! < width / 2 ? "start" : "end"}
                fontSize={12}
                fontWeight={300}
                fill="hsl(var(--foreground))"
            >
                {node.name}
                <tspan fontSize="10px" fill="hsl(var(--muted-foreground))">{` (${format(node.value!)})`}</tspan>
            </text>
        </g>
    ));

    const allLinks = sankeyLayout.links.map((link, i) => (
        <path
            key={i}
            d={sankeyLinkHorizontal()(link) || undefined}
            stroke={COLORS[(link.source as any).index % COLORS.length]}
            fill="none"
            strokeOpacity={0.3}
            strokeWidth={link.width}
        />
    ));

    return (
        <svg width={width} height={height}>
            {allNodes}
            {allLinks}
        </svg>
    );
};

