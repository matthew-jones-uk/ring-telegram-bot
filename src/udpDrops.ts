import { readFileSync } from 'fs';

/**
 * Extracts the UDP receive-buffer error count from the text of /proc/net/snmp.
 *
 * The file has a header line and a values line for each protocol, e.g.
 *   Udp: InDatagrams NoPorts InErrors OutDatagrams RcvbufErrors ...
 *   Udp: 1000 5 3 900 7 ...
 * RcvbufErrors counts packets the kernel dropped because a socket's receive buffer was full.
 */
export const parseUdpRcvbufErrors = (snmp: string): number | undefined => {
    // "Udp:" only matches the UDP rows; the UDP-Lite rows start with "UdpLite:".
    const rows = snmp.split('\n').filter((line) => line.startsWith('Udp:'));
    if (rows.length < 2) return undefined;
    const column = rows[0].trim().split(/\s+/).indexOf('RcvbufErrors');
    const value = Number(rows[1].trim().split(/\s+/)[column]);
    return column > 0 && Number.isFinite(value) ? value : undefined;
};

/**
 * Current UDP receive-buffer error count for this network namespace, or undefined where it can't be read
 * (non-Linux, or no /proc). In a container with its own network this covers only the bot's own sockets.
 */
export const readUdpRcvbufErrors = (): number | undefined => {
    try {
        return parseUdpRcvbufErrors(readFileSync('/proc/net/snmp', 'utf8'));
    } catch {
        return undefined;
    }
};
