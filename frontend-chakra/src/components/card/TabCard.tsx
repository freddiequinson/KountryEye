import { Children, isValidElement, useState, type ReactNode } from 'react'
import { Box, Flex, Heading, Icon, Text, useColorModeValue } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import type { IconType } from 'react-icons'
import Card from '@/components/card/Card'

export type TabDef = { label: ReactNode; icon?: IconType; content: ReactNode; actions?: ReactNode }

// One card whose header switches between views, used instead of laying peer cards side by side.
// Tabs are text links in Horizon's style with an underline that slides to the selected one.
export default function TabCard({ title, tabs, defaultIndex = 0, ...rest }: { title?: ReactNode; tabs: TabDef[]; defaultIndex?: number } & Omit<React.ComponentProps<typeof Card>, 'title'>) {
  const [index, setIndex] = useState(defaultIndex)
  const textColor = useColorModeValue('secondaryGray.900', 'white')
  const border = useColorModeValue('secondaryGray.100', 'whiteAlpha.100')
  const active = tabs[Math.min(index, tabs.length - 1)]
  const id = typeof title === 'string' ? title : 'tabs'

  return (
    <Card {...rest}>
      <Flex justify="space-between" align="center" gap="12px 24px" wrap="wrap" borderBottom="1px solid" borderColor={border} mb="20px">
        {title && (
          <Heading as="h3" fontSize="22px" fontWeight="700" lineHeight="1.15" color={textColor} pb="14px">
            {title}
          </Heading>
        )}
        <Flex role="tablist" gap={{ base: '18px', md: '28px' }} overflowX="auto" className="thin-scrollbar" me="auto" ms={title ? { md: '12px' } : 0}>
          {tabs.map((tab, i) => {
            const selected = i === index
            return (
              <Flex
                key={i}
                as="button"
                type="button"
                role="tab"
                aria-selected={selected}
                position="relative"
                align="center"
                gap="8px"
                pb="14px"
                fontSize="md"
                fontWeight={selected ? '700' : '500'}
                color={selected ? 'brand.600' : 'secondaryGray.600'}
                _dark={{ color: selected ? 'white' : 'secondaryGray.500' }}
                _hover={{ color: selected ? undefined : textColor }}
                whiteSpace="nowrap"
                transition="color .15s ease"
                onClick={() => setIndex(i)}
              >
                {tab.icon && <Icon as={tab.icon} w="18px" h="18px" />}
                {tab.label}
                {selected && <Box as={motion.div} layoutId={`tabcard-${id}`} position="absolute" left="0" right="0" bottom="-1px" h="3px" borderTopRadius="3px" bg="brand.500" />}
              </Flex>
            )
          })}
        </Flex>
        {active.actions && (
          <Flex gap="8px" pb="10px">
            {active.actions}
          </Flex>
        )}
      </Flex>
      <motion.div key={index} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
        {active.content}
      </motion.div>
    </Card>
  )
}

// Small heading used inside tab content when a view needs its own label.
export function TabNote({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="sm" fontWeight="500" color="secondaryGray.600" mb="14px">
      {children}
    </Text>
  )
}

// Drop-in replacement for a grid of <SectionCard>s: each card becomes a tab (title -> label,
// description -> note above the content, actions -> header actions).
export function TabbedSections({ children, title, ...rest }: { children: ReactNode; title?: ReactNode } & Omit<React.ComponentProps<typeof Card>, 'title'>) {
  const tabs: TabDef[] = Children.toArray(children)
    .filter(isValidElement)
    .map((el: any) => ({
      label: el.props.title,
      actions: el.props.actions || undefined,
      content: (
        <>
          {el.props.description && <TabNote>{el.props.description}</TabNote>}
          {el.props.children}
        </>
      ),
    }))
  return <TabCard title={title} tabs={tabs} {...rest} />
}
